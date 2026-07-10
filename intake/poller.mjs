// Intake-poller: leest de intake-mailbox, bewaart elk bericht ORIGINEEL in
// Supabase (+ bijlagen in Storage), en laat Claude er actiepunten uit halen.
//
// Draaien:
//   node intake/poller.mjs --once      (eenmalig, bv. lokaal testen)
//   in productie: externe cron (cron-job.org, ~elke 2 min) roept /api/intake aan,
//   plus 1x/dag de Vercel-cron als vangnet (zie vercel.json)

import crypto from "crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createClient } from "@supabase/supabase-js";
import { extractItems } from "./extract.mjs";
import { sendToAll } from "../lib/push.mjs";
import { beoordeelBijlage, hashVan } from "../lib/bijlagefilter.mjs";
import { magDirect } from "../lib/dropboxsync.mjs";
import { logUsage } from "../lib/usage.mjs";

const BUCKET = "intake";

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function loadCatalog(db) {
  const { data: projects } = await db
    .from("projects")
    .select("id, client, project");
  return (projects || []).map(p => ({
    project_id: p.id,
    client: p.client || "",
    project: p.project || "",
  }));
}

// Vaste AI-context (Over Begeister / Jeroen / Marlon) → string voor de extractie.
async function loadContext(db) {
  try {
    const { data } = await db.from("app_context").select("key, body");
    const m = {}; (data || []).forEach(r => { m[r.key] = r.body || ""; });
    let s = "";
    if (m.begeister) s += "OVER BEGEISTER:\n" + m.begeister + "\n\n";
    if (m.jeroen) s += "OVER JEROEN:\n" + m.jeroen + "\n\n";
    if (m.marlon) s += "OVER MARLON:\n" + m.marlon + "\n";
    return s.trim();
  } catch (_) { return ""; }
}

// Gevonden contacten opslaan. Dedupe: op e-mail indien aanwezig (upsert),
// anders alleen inserten als er nog geen contact met dezelfde (lower) naam is.
async function saveContacts(db, contacts, sourceId, projectId) {
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
    } else {
      const { data: existing } = await db
        .from("contacts").select("id").ilike("name", name).maybeSingle();
      if (!existing) await db.from("contacts").insert(row);
    }
  }
}

// Eén IMAP-sessie: verwerk alle ongelezen berichten.
export async function run() {
  const db = supa();
  const catalog = await loadCatalog(db);
  const context = await loadContext(db);
  const today = new Date().toISOString().slice(0, 10);

  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },
    logger: false,
  });

  const result = { processed: 0, items: 0, skipped: 0, errors: [] };
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const unseen = await client.search({ seen: false });
    for (const uid of unseen) {
      try {
        const msg = await client.fetchOne(uid, { source: true });
        const mail = await simpleParser(msg.source);
        const body = (mail.text || mail.html || "").toString().trim();
        const sender = mail.from?.text || "";
        // Stabiele dedup-sleutel: Message-ID indien aanwezig, anders een hash van de inhoud
        // (voorkomt dat berichten zonder Message-ID elke run opnieuw als nieuw binnenkomen).
        const dateKey = mail.date ? new Date(mail.date).toISOString() : "";
        const messageId = mail.messageId
          || "h-" + crypto.createHash("sha1").update(sender + "|" + (mail.subject || "") + "|" + dateKey + "|" + body).digest("hex");

        // dubbele verwerking voorkomen
        const { data: existing } = await db
          .from("sources").select("id").eq("message_id", messageId).maybeSingle();
        if (existing) { result.skipped++; await client.messageFlagsAdd(uid, ["\\Seen"]); continue; }

        // 1) bron origineel opslaan
        const { data: source, error: srcErr } = await db.from("sources").insert({
          channel: "email",
          sender,
          subject: mail.subject || "",
          body,
          message_id: messageId,
          received_at: mail.date || new Date(),
          processed: false,
        }).select().single();
        if (srcErr) throw srcErr;

        // 2) bijlagen naar Storage — maar niet het behang uit de handtekening.
        //    Welke bestanden we al vaker zagen staat in bijlage_hashes; komt iets in drie
        //    of meer bronnen voor, dan wordt het voortaan overgeslagen.
        const { data: geblokkeerd } = await db
          .from("bijlage_hashes").select("hash").eq("geblokkeerd", true);
        const bekendeHashes = new Set((geblokkeerd || []).map(r => r.hash));

        for (const att of mail.attachments || []) {
          const oordeel = beoordeelBijlage(att, { bekendeHashes });
          if (!oordeel.houden) {
            console.log(`bijlage overgeslagen (${oordeel.reden}): ${att.filename || "naamloos"}`);
            continue;
          }

          const path = `${source.id}/${att.filename || "bijlage"}`;
          const up = await db.storage.from(BUCKET).upload(path, att.content, {
            contentType: att.contentType, upsert: true,
          });
          if (!up.error) {
            await db.from("attachments").insert({
              source_id: source.id, filename: att.filename, storage_path: path,
              mime: att.contentType, size: att.size,
            });
            // Klein genoeg? Dan meteen naar Dropbox. Grote bestanden pakt de uurlijkse
            // wachtrij op — anders staat de intake tientallen seconden stil per foto.
            // Lukt het, dan zetten we het document op gesynct; anders zou de wachtrij het
            // straks nóg een keer uploaden.
            if (magDirect(att.size)) {
              try {
                const r = await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/dropbox/list`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "upload", name: att.filename,
                    b64: att.content.toString("base64"), target: "Postvak In", owner_type: "client" }),
                }).then(x => x.json());
                const link = r && r.file ? r.file.link : null;
                if (link) {
                  await db.from("documents")
                    .update({ dropbox_path: link, dropbox_gesynct_op: new Date() })
                    .eq("storage_path", path);
                }
              } catch (_) { /* mislukt? de uurlijkse ronde pakt 'm alsnog op */ }
            }

            // Tel mee hoe vaak deze inhoud voorbijkomt. Bij drie bronnen slaat de trigger 'm dicht.
            try {
              const h = hashVan(att.content);
              const { data: bestaand } = await db
                .from("bijlage_hashes").select("bronnen").eq("hash", h).maybeSingle();
              if (bestaand) {
                await db.from("bijlage_hashes")
                  .update({ bronnen: bestaand.bronnen + 1, laatst_gezien: new Date() })
                  .eq("hash", h);
              } else {
                await db.from("bijlage_hashes").insert({
                  hash: h, filename: att.filename, mime: att.contentType, size: att.size,
                });
              }
            } catch (_) { /* tellen is een gemak, geen noodzaak */ }
          }
        }

        // 3) Claude haalt actiepunten (en contacten) eruit
        const { items, summary, contacts, usage, client: exClient = "", project: exProject = "" } = await extractItems({
          text: body, sender, subject: mail.subject || "", today, catalog, context,
        });
        // verbruik loggen (faalt stil)
        if (usage) await logUsage(db, { source: "intake", ...usage });
        if (items.length) {
          // Eén kaart per bericht: 2+ actiepunten worden afvinkbare subpunten (checklist) onder
          // één taak. Zo blijft het Postvak In overzichtelijk i.p.v. een muur van losse kaartjes.
          const grouped = items.length >= 2;
          const rec = {
            project_id: (items.find(it => it.project_id) || {}).project_id || items[0].project_id || null,
            source_id: source.id,
            title: grouped ? String(summary || mail.subject || "Nieuwe taken").slice(0, 140) : items[0].title,
            owner: grouped ? null : (items[0].owner || null),
            contact: grouped ? null : (items[0].contact || null),
            due: grouped ? null : (items[0].due || null),
            status: grouped ? "todo" : (["todo", "doing", "wait", "done"].includes(items[0].status) ? items[0].status : "todo"),
            checklist: grouped ? items.map(it => ({ t: it.title, done: false })) : [],
          };
          await db.from("items").insert(rec);
        }

        // 3b) gevonden contacten opslaan (dedupe op e-mail; anders op naam)
        try {
          // project_id van dit bericht: het eerste item dat een eenduidig project kreeg
          let msgProject = (items.find(it => it.project_id) || {}).project_id || null;
          // Vangnet voor offertes/facturen met (bijna) lege body: match de door Claude herkende
          // klant/project tegen de catalogus, zodat het document tóch aan het project hangt.
          if (!msgProject && (exClient || exProject)) {
            const norm = v => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const nc = norm(exClient), np = norm(exProject);
            const hit = (nc && np && catalog.find(c => norm(c.client) === nc && norm(c.project) === np))
                     || (nc && catalog.find(c => norm(c.client) === nc));
            if (hit) msgProject = hit.project_id;
          }
          if (msgProject) await db.from("sources").update({ project_id: msgProject }).eq("id", source.id);
          await saveContacts(db, contacts, source.id, msgProject);
        } catch (e) { console.error("contact-fout:", e.message); }

        await db.from("sources").update({ processed: true, summary: summary || null }).eq("id", source.id);

        // 1 melding per binnengekomen bericht — korte AI-samenvatting
        try {
          const raw = (summary || mail.subject || "nieuw bericht").trim();
          const pushBody = raw.length > 70 ? raw.slice(0, 69).trimEnd() + "…" : raw;
          await sendToAll(db, { title: "In afwachting", body: pushBody, url: "/" });
        } catch (e) { console.error("push-fout:", e.message); }

        await client.messageFlagsAdd(uid, ["\\Seen"]);
        result.processed++; result.items += items.length;
      } catch (e) {
        console.error("Fout bij bericht", uid, e.message);
        result.errors.push(String(e.message));
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return result;
}

// standalone aanroep
if (process.argv.includes("--once") || process.env.RUN_INTAKE === "1") {
  run().then(r => { console.log("Intake klaar:", r); process.exit(0); })
       .catch(e => { console.error(e); process.exit(1); });
}
