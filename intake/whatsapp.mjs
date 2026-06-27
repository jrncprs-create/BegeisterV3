// WhatsApp Cloud API webhook-verwerking.
// Verificatie (GET) + inkomende berichten (POST) → bron opslaan + AI-extractie,
// exact dezelfde pijplijn als e-mail (zie poller.mjs). Wordt aangeroepen vanuit api/intake.mjs.
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { extractItems } from "./extract.mjs";
import { logUsage } from "../lib/usage.mjs";
import { sendToAll } from "../lib/push.mjs";

const VERIFY_TOKEN = (process.env.WHATSAPP_VERIFY_TOKEN || "begeister-wa-2026").trim();

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// GET-handshake: Meta stuurt hub.mode/hub.verify_token/hub.challenge.
export function verifyChallenge(q) {
  if (q && q["hub.mode"] === "subscribe" && q["hub.verify_token"] === VERIFY_TOKEN) {
    return q["hub.challenge"];
  }
  return null;
}

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

function msgToText(msg) {
  if (msg.type === "text") return (msg.text && msg.text.body) || "";
  if (msg.type === "image") return "[afbeelding via WhatsApp]" + ((msg.image && msg.image.caption) ? (": " + msg.image.caption) : "");
  if (msg.type === "document") return "[document via WhatsApp: " + ((msg.document && msg.document.filename) || "bestand") + "]" + ((msg.document && msg.document.caption) ? (" " + msg.document.caption) : "");
  if (msg.type === "video") return "[video via WhatsApp]" + ((msg.video && msg.video.caption) ? (": " + msg.video.caption) : "");
  if (msg.type === "audio" || msg.type === "voice") return "[spraakbericht via WhatsApp]";
  if (msg.type === "location") return "[locatie via WhatsApp]";
  return "[" + (msg.type || "onbekend") + "-bericht via WhatsApp]";
}

// POST-events verwerken. Geeft nooit een fout terug naar Meta (altijd 200 in de handler).
export async function handleEvent(body) {
  if (!body || body.object !== "whatsapp_business_account") return { skipped: true };
  const db = supa();
  const today = new Date().toISOString().slice(0, 10);

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

  let processed = 0;
  for (const entry of (body.entry || [])) {
    for (const ch of (entry.changes || [])) {
      const val = ch.value || {};
      const nameByWa = {};
      (val.contacts || []).forEach(c => { if (c.wa_id) nameByWa[c.wa_id] = (c.profile && c.profile.name) || ""; });
      for (const msg of (val.messages || [])) {
        try {
          const waId = msg.from || "";
          const sender = (nameByWa[waId] || waId) + (waId ? ` (${waId})` : "");
          const text = msgToText(msg);
          const messageId = "wa-" + (msg.id || crypto.createHash("sha1").update(waId + "|" + (msg.timestamp || "") + "|" + text).digest("hex"));

          const { data: existing } = await db.from("sources").select("id").eq("message_id", messageId).maybeSingle();
          if (existing) continue;

          const { data: source, error: srcErr } = await db.from("sources").insert({
            channel: "whatsapp", sender, subject: "", body: text,
            message_id: messageId,
            received_at: new Date(Number(msg.timestamp || Math.floor(Date.now() / 1000)) * 1000),
            processed: false,
          }).select().single();
          if (srcErr) throw srcErr;

          const { items, summary, contacts, usage } = await extractItems({ text, sender, subject: "", today, catalog, context });
          if (usage) await logUsage(db, { source: "whatsapp", ...usage });
          if (items && items.length) {
            await db.from("items").insert(items.map(it => ({
              project_id: it.project_id || null, source_id: source.id, title: it.title,
              owner: it.owner || null, contact: it.contact || null, due: it.due || null,
              status: ["todo", "doing", "wait", "done"].includes(it.status) ? it.status : "todo",
            })));
          }
          try {
            const msgProject = (items.find(it => it.project_id) || {}).project_id || null;
            await saveContacts(db, contacts, source.id, msgProject);
          } catch (_) {}
          await db.from("sources").update({ processed: true, summary: summary || null }).eq("id", source.id);
          try {
            const raw = (summary || text || "WhatsApp-bericht").trim();
            const pb = raw.length > 70 ? raw.slice(0, 69).trimEnd() + "…" : raw;
            await sendToAll(db, { title: "WhatsApp", body: pb, url: "/" });
          } catch (_) {}
          processed++;
        } catch (e) { console.error("wa-msg:", e.message); }
      }
    }
  }
  return { processed };
}
