// Eenmalig backfill-endpoint: scant ALLE bronnen (sources) en haalt er met Claude
// contacten uit, die vervolgens in de `contacts`-tabel worden opgeslagen (zelfde
// dedupe-logica als de poller). LET OP: dit doet 1 AI-call per source — de gebruiker
// triggert dit zelf één keer. Beveiligd met CRON_SECRET in de Authorization-header.
//
// Aanroep (voorbeeld):
//   curl -X POST https://<host>/api/backfill-contacts -H "Authorization: Bearer $CRON_SECRET"
import { createClient } from "@supabase/supabase-js";
import { extractItems } from "../intake/extract.mjs";
import { logUsage } from "../lib/usage.mjs";

// Service-role client (eigen client zodat het endpoint los van lib/usage werkt).
function svc() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Catalogus (projecten) voor extractItems.
async function loadCatalog(db) {
  const { data: projects } = await db.from("projects").select("id, client, project");
  return (projects || []).map(p => ({
    project_id: p.id,
    client: p.client || "",
    project: p.project || "",
  }));
}

// Identiek aan poller.saveContacts: upsert op e-mail; anders insert-if-name-not-exists.
async function saveContacts(db, contacts, sourceId, projectId) {
  let saved = 0;
  for (const c of (contacts || [])) {
    const name = (c.name || "").trim();
    if (!name) continue;
    const email = (c.email || "").trim().toLowerCase();
    const row = {
      name,
      email: email || null,
      phone: (c.phone || "").trim() || null,
      company: (c.company || "").trim() || null,
      role: (c.role || "").trim() || null,
      source_id: sourceId || null,
      project_id: projectId || null,
    };
    if (email) {
      await db.from("contacts").upsert(row, { onConflict: "email" });
      saved++;
    } else {
      const { data: existing } = await db
        .from("contacts").select("id").ilike("name", name).maybeSingle();
      if (!existing) { await db.from("contacts").insert(row); saved++; }
    }
  }
  return saved;
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const db = svc();
    const catalog = await loadCatalog(db);
    const today = new Date().toISOString().slice(0, 10);

    // Kostenbeheersing: alleen tekst-bronnen (email/paste), en niet te lange body.
    const MAX_BODY = 12000; // tekens — lange bodies overslaan om kosten/tokens te beperken
    const { data: sources, error } = await db
      .from("sources")
      .select("id, channel, sender, subject, body")
      .in("channel", ["email", "paste"]);
    if (error) throw error;

    const result = { ok: true, scanned: 0, contactsFound: 0, skipped: 0, errors: [] };

    for (const s of (sources || [])) {
      const body = (s.body || "").trim();
      if (!body) { result.skipped++; continue; }
      if (body.length > MAX_BODY) { result.skipped++; continue; }
      try {
        const { items, contacts, usage } = await extractItems({
          text: body,
          sender: s.sender || "",
          subject: s.subject || "",
          today,
          catalog,
        });
        if (usage) await logUsage(db, { source: "backfill-contacts", ...usage });
        const msgProject = (items.find(it => it.project_id) || {}).project_id || null;
        result.contactsFound += await saveContacts(db, contacts, s.id, msgProject);
        result.scanned++;
      } catch (e) {
        result.errors.push({ source_id: s.id, error: String(e.message || e) });
      }
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
