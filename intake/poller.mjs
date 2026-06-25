// Intake-poller: leest de intake-mailbox, bewaart elk bericht ORIGINEEL in
// Supabase (+ bijlagen in Storage), en laat Claude er actiepunten uit halen.
//
// Draaien:
//   node intake/poller.mjs --once      (eenmalig, bv. lokaal testen)
//   wordt op Vercel elke 5 min aangeroepen via /api/intake (zie vercel.json)

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createClient } from "@supabase/supabase-js";
import { extractItems } from "./extract.mjs";

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

// Eén IMAP-sessie: verwerk alle ongelezen berichten.
export async function run() {
  const db = supa();
  const catalog = await loadCatalog(db);
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
        const messageId = mail.messageId || `uid-${uid}-${Date.now()}`;

        // dubbele verwerking voorkomen
        const { data: existing } = await db
          .from("sources").select("id").eq("message_id", messageId).maybeSingle();
        if (existing) { result.skipped++; await client.messageFlagsAdd(uid, ["\\Seen"]); continue; }

        const body = (mail.text || mail.html || "").toString().trim();
        const sender = mail.from?.text || "";

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

        // 2) bijlagen naar Storage
        for (const att of mail.attachments || []) {
          const path = `${source.id}/${att.filename || "bijlage"}`;
          const up = await db.storage.from(BUCKET).upload(path, att.content, {
            contentType: att.contentType, upsert: true,
          });
          if (!up.error) {
            await db.from("attachments").insert({
              source_id: source.id, filename: att.filename, storage_path: path,
              mime: att.contentType, size: att.size,
            });
          }
        }

        // 3) Claude haalt actiepunten eruit
        const { items, summary } = await extractItems({
          text: body, sender, subject: mail.subject || "", today, catalog,
        });
        if (items.length) {
          await db.from("items").insert(items.map(it => ({
            project_id: it.project_id || null,
            source_id: source.id,
            title: it.title,
            owner: it.owner || null,
            contact: it.contact || null,
            due: it.due || null,
            status: ["todo", "doing", "wait", "done"].includes(it.status) ? it.status : "todo",
          })));
        }
        await db.from("sources").update({ processed: true, summary: summary || null }).eq("id", source.id);

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
