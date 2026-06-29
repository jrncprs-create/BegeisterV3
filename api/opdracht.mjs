// Intake via iOS-Opdracht (Shortcut). Ontvangt een POST met tekst en/of een foto
// en draait dezelfde pijplijn als mail/WhatsApp: bron opslaan -> Claude haalt
// actiepunten eruit -> taken + push. Zet sources.channel = 'opdracht'.
//
// Beveiliging: een geheime sleutel (OPDRACHT_SECRET of CRON_SECRET, met een
// fallback-default zoals ook bij de VAPID-keys — dit is een privé-repo).
// De Opdracht stuurt die sleutel mee in de Authorization-header (Bearer) of in
// het JSON-veld "secret".
//
// Verwachte JSON-body:
//   { text?: string, image?: base64-zonder-prefix, media_type?: string,
//     filename?: string, who?: "Jeroen"|"Marlon", secret?: string }
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { extractItems } from "../intake/extract.mjs";
import { logUsage } from "../lib/usage.mjs";
import { sendToAll } from "../lib/push.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const VISION_MODEL = "claude-sonnet-4-6";
const SECRET = (process.env.OPDRACHT_SECRET || process.env.CRON_SECRET || "begeister-opdracht-2026").trim();

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Vaste sleutel die de iOS-Opdracht meestuurt (privé-repo; zelfde model als de VAPID-fallback).
const FIXED_SECRET = "begeister-opdracht-2026";
function authOk(req) {
  const hdr = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
  const q = ((req.query && (req.query.secret || req.query.token)) || "").toString().trim();
  const body = ((req.body && !Buffer.isBuffer(req.body) && (req.body.secret || req.body.token)) || "").toString().trim();
  const valid = v => !!v && (v === SECRET || v === FIXED_SECRET);
  return valid(hdr) || valid(q) || valid(body);
}

async function loadCatalogContext(db) {
  let catalog = [], context = "";
  try {
    const { data: projects } = await db.from("projects").select("id, client, project");
    catalog = (projects || []).map(p => ({ project_id: p.id, client: p.client || "", project: p.project || "" }));
  } catch (_) {}
  try {
    const { data } = await db.from("app_context").select("key, body");
    const m = {}; (data || []).forEach(r => { m[r.key] = r.body || ""; });
    let s = "";
    if (m.begeister) s += "OVER BEGEISTER:\n" + m.begeister + "\n\n";
    if (m.jeroen) s += "OVER JEROEN:\n" + m.jeroen + "\n\n";
    if (m.marlon) s += "OVER MARLON:\n" + m.marlon + "\n";
    context = s.trim();
  } catch (_) {}
  return { catalog, context };
}

// Externe contacten uit een bericht opslaan (zelfde gedrag als de WhatsApp-route).
async function saveContacts(db, contacts, sourceId, projectId) {
  for (const c of (contacts || [])) {
    const name = (c.name || "").trim();
    if (!name) continue;
    const email = (c.email || "").trim().toLowerCase();
    const row = {
      name, email: email || null,
      phone: (c.phone || "").trim() || null,
      company: (c.company || "").trim() || null,
      role: (c.role || "").trim() || null,
      source_id: sourceId || null, project_id: projectId || null,
    };
    if (email) await db.from("contacts").upsert(row, { onConflict: "email" });
    else {
      const { data: existing } = await db.from("contacts").select("id").ilike("name", name).maybeSingle();
      if (!existing) await db.from("contacts").insert(row);
    }
  }
}

// Foto bekijken met Claude -> samenvatting + actiepunten (zelfde prompt als api/vision.mjs).
async function visionExtract({ image, media_type, filename, text, today, catalog, context }) {
  if (!anthropic) return { reply: "(AI staat uit) Foto via Opdracht ontvangen.", items: [], usage: null };
  const cat = (catalog || []).map(c => `- ${c.project_id} → ${c.client} · ${c.project}`).join("\n") || "(nog geen klanten/projecten)";
  const sys = `Je bent de AI-assistent van Begeister (licht, decor, events). Je krijgt een FOTO (bv. een schermafbeelding van een appje/mail, een whiteboard, een document of een situatie ter plaatse).
Vat in 1-2 zinnen samen wat erop staat, en haal er concrete ACTIEPUNTEN uit als die er zijn. Verzin niets.
owner = "Jeroen" of "Marlon" of leeg. contact = externe persoon of leeg. due = YYYY-MM-DD of null. status = todo. project_id = best passend uit de catalogus of null.
${context ? "VASTE CONTEXT (team/bedrijf — gebruik dit):\n" + context + "\n" : ""}VANDAAG: ${today || ""}.
CATALOGUS (project_id → klant · project):\n${cat}
Antwoord ALLEEN met geldige JSON: {"reply":"korte samenvatting","items":[{"title":"","owner":"","contact":"","due":null,"status":"todo","project_id":null}]}`;
  const resp = await anthropic.messages.create({
    model: VISION_MODEL, max_tokens: 1400, system: sys,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image } },
        { type: "text", text: `Toegevoegde afbeelding${filename ? " (" + filename + ")" : ""}.${text ? " Begeleidende tekst: " + text : ""} Vat samen en stel actiepunten voor.` },
      ],
    }],
  });
  const usage = {
    source: "opdracht-vision", model: VISION_MODEL,
    inputTokens: resp?.usage?.input_tokens || 0,
    outputTokens: resp?.usage?.output_tokens || 0,
    webSearches: 0,
  };
  const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
  const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed;
  try { parsed = JSON.parse(slice); }
  catch (_) { parsed = { reply: raw.trim() || "Foto bekeken.", items: [] }; }
  return { reply: parsed.reply || "", items: Array.isArray(parsed.items) ? parsed.items : [], usage };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!authOk(req)) return res.status(401).json({ error: "unauthorized" });

  // Twee manieren van aanleveren:
  //  A) JSON  → { text, image(base64), media_type, who, secret }
  //  B) Ruw bestand (Opdracht "Verzoektekst: Bestand") → binaire body; velden via querystring (?who=…)
  const rawBuf = Buffer.isBuffer(req.body) ? req.body : null;
  const body = rawBuf ? {} : (req.body || {});
  const q = req.query || {};
  const ctype = (req.headers["content-type"] || "").toLowerCase();

  const text = (rawBuf ? (q.text || "") : (body.text || "")).toString().trim();
  let image = "", media_type = (body.media_type || q.media_type || "image/jpeg").toString();
  if (rawBuf) {
    // ruw bestand: alleen afbeeldingen worden door vision gelezen
    image = rawBuf.toString("base64");
    if (ctype.startsWith("image/")) media_type = ctype;
  } else {
    image = body.image ? String(body.image).replace(/^data:[^;]+;base64,/, "") : "";
  }
  const filename = (rawBuf ? (q.filename || "") : (body.filename || "")).toString();
  const who = (rawBuf ? (q.who || "") : (body.who || "")).toString().trim();
  if (!text && !image) return res.status(400).json({ error: "geen tekst of foto meegestuurd" });

  const db = supa();
  if (!db) return res.status(500).json({ error: "geen database-config" });
  const today = new Date().toISOString().slice(0, 10);
  const { catalog, context } = await loadCatalogContext(db);

  try {
    let items = [], summary = "", contacts = [], usage = null;
    let bodyText = text;

    if (image) {
      const v = await visionExtract({ image, media_type, filename, text, today, catalog, context });
      items = v.items; summary = v.reply; usage = v.usage;
      bodyText = text || ("[foto via Opdracht" + (filename ? ": " + filename : "") + "]");
    } else {
      const ex = await extractItems({ text, sender: who || "Opdracht", subject: "", today, catalog, context });
      items = ex.items; summary = ex.summary; contacts = ex.contacts;
      usage = ex.usage ? { source: "opdracht", ...ex.usage } : null;
    }

    const { data: source, error: srcErr } = await db.from("sources").insert({
      channel: "opdracht", sender: who || "Opdracht", subject: "", body: bodyText,
      received_at: new Date(), processed: true, summary: summary || null,
    }).select().single();
    if (srcErr) throw srcErr;

    if (items && items.length) {
      await db.from("items").insert(items.map(it => ({
        project_id: it.project_id || null, source_id: source.id, title: it.title,
        owner: it.owner || null, contact: it.contact || null, due: it.due || null,
        status: ["todo", "doing", "wait", "done"].includes(it.status) ? it.status : "todo",
      })));
    }
    try {
      const msgProject = (items.find(it => it.project_id) || {}).project_id || null;
      // Tag de bron met hetzelfde project als zijn actiepunten → groepeert mee onder de klant in Bronnen.
      if (msgProject) await db.from("sources").update({ project_id: msgProject }).eq("id", source.id);
      await saveContacts(db, contacts, source.id, msgProject);
    } catch (_) {}
    if (usage) await logUsage(db, usage);
    try {
      const raw = (summary || bodyText || "Nieuwe opdracht").trim();
      const pb = raw.length > 70 ? raw.slice(0, 69).trimEnd() + "…" : raw;
      await sendToAll(db, { title: "Opdracht", body: pb, url: "/" });
    } catch (_) {}

    return res.status(200).json({ ok: true, items: (items || []).length, summary: summary || "" });
  } catch (e) {
    console.error("opdracht:", e.message);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
