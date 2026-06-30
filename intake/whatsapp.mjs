// WhatsApp Cloud API webhook-verwerking.
// Verificatie (GET) + inkomende berichten (POST) → bron opslaan + AI-extractie,
// exact dezelfde pijplijn als e-mail (zie poller.mjs). Wordt aangeroepen vanuit api/intake.mjs.
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { extractItems } from "./extract.mjs";
import { logUsage } from "../lib/usage.mjs";
import { sendToAll } from "../lib/push.mjs";
import { addInspirationImageBuffer, addInspirationLink } from "./inspiration.mjs";

// Trefwoord waarmee Jeroen/Marlon een appje als INSPIRATIE markeren i.p.v. een taak:
// elk los woord dat met "insp" begint (insp, inspi, inspo, inspiratie, inspiration, …).
const INSP_RE = /(^|[\s#@.,;:!?])insp\w*/i;
const URL_RE = /https?:\/\/[^\s<>()"']+/i;
// Een Instagram-link is altijd inspiratie — ook zonder trefwoord (je ziet dat 'ie van insta komt).
const INSTA_RE = /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s<>()"']+/i;

const VERIFY_TOKEN = (process.env.WHATSAPP_VERIFY_TOKEN || "begeister-wa-2026").trim();
const WA_TOKEN = (process.env.WHATSAPP_TOKEN || "").trim();
const AKEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = AKEY ? new Anthropic({ apiKey: AKEY }) : null;
const VISION_MODEL = "claude-sonnet-4-6";
const GRAPH = "https://graph.facebook.com/v21.0/";
// Alleen Jeroen en Marlon appen naar het Begeister-nummer; koppel hun WhatsApp-nummer aan hun naam.
const WHO_BY_NUMBER = { "31628777056": "Jeroen", "31642634901": "Marlon" };

// WhatsApp-media (foto/document) ophalen: eerst de media-URL, dan de bytes. Vereist WHATSAPP_TOKEN.
async function fetchMedia(mediaId) {
  if (!WA_TOKEN || !mediaId) return null;
  try {
    const meta = await fetch(GRAPH + mediaId, { headers: { Authorization: "Bearer " + WA_TOKEN } }).then(r => r.json());
    if (!meta || !meta.url) return null;
    const buf = await fetch(meta.url, { headers: { Authorization: "Bearer " + WA_TOKEN } }).then(r => r.arrayBuffer());
    return { b64: Buffer.from(buf).toString("base64"), mime: (meta.mime_type || "image/jpeg").split(";")[0] };
  } catch (_) { return null; }
}

// Doorgestuurde foto/PDF met Claude bekijken → samenvatting + actiepunten (zelfde pijplijn als de Opdracht).
async function mediaExtract({ b64, mime, caption, sender, today, catalog, context }) {
  if (!anthropic) return { reply: "(AI staat uit) WhatsApp-media ontvangen.", items: [], usage: null };
  const cat = (catalog || []).map(c => `- ${c.project_id} → ${c.client} · ${c.project}`).join("\n") || "(nog geen klanten/projecten)";
  const isPdf = /pdf/i.test(mime);
  const block = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: b64 } };
  const sys = `Je bent de AI-assistent van Begeister (licht, decor, events). Je krijgt een ${isPdf ? "PDF" : "FOTO"} die iemand via WhatsApp heeft doorgestuurd (bv. een screenshot van een appje, een document, of een situatie ter plaatse).
Vat in 1-2 zinnen samen wat erop staat, en haal er concrete ACTIEPUNTEN uit als die er zijn. Verzin niets.
owner = "Jeroen" of "Marlon" of leeg. contact = externe persoon of leeg. due = YYYY-MM-DD of null. status = todo. project_id = best passend uit de catalogus of null.
${context ? "VASTE CONTEXT (team/bedrijf — gebruik dit):\n" + context + "\n" : ""}VANDAAG: ${today || ""}.
CATALOGUS (project_id → klant · project):\n${cat}
Antwoord ALLEEN met geldige JSON: {"reply":"korte samenvatting","items":[{"title":"","owner":"","contact":"","due":null,"status":"todo","project_id":null}]}`;
  const resp = await anthropic.messages.create({
    model: VISION_MODEL, max_tokens: 1400, system: sys,
    messages: [{ role: "user", content: [block, { type: "text", text: `Doorgestuurd via WhatsApp${sender ? " door " + sender : ""}${caption ? ". Onderschrift: " + caption : ""}. Vat samen en stel actiepunten voor.` }] }],
  });
  const usage = { model: VISION_MODEL, inputTokens: resp?.usage?.input_tokens || 0, outputTokens: resp?.usage?.output_tokens || 0, webSearches: 0 };
  const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
  const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed; try { parsed = JSON.parse(slice); } catch (_) { parsed = { reply: raw.trim() || "Media bekeken.", items: [] }; }
  return { reply: parsed.reply || "", items: Array.isArray(parsed.items) ? parsed.items : [], usage };
}

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
          // Alleen Jeroen en Marlon sturen naar het Begeister-nummer → herken ze aan hun nummer.
          const who = WHO_BY_NUMBER[waId] || "";
          const sender = who || ((nameByWa[waId] || waId) + (waId ? ` (${waId})` : ""));
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

          // ── Inspiratie-route: bevat het appje "insp/inspi/inspiratie"? → naar Inspiratie i.p.v. taken.
          const rawCap = msg.type === "text" ? ((msg.text && msg.text.body) || "")
            : msg.type === "image" ? ((msg.image && msg.image.caption) || "")
            : msg.type === "document" ? ((msg.document && msg.document.caption) || "")
            : msg.type === "video" ? ((msg.video && msg.video.caption) || "")
            : "";
          if (INSP_RE.test(rawCap) || INSTA_RE.test(rawCap)) {
            let theme = "Inspiratie";
            const inspUrl = (rawCap.match(INSTA_RE) || rawCap.match(URL_RE) || [])[0] || "";
            // Los woord dat je meestuurt (zonder de "insp"-trigger en zonder de link) wordt het thema/de map.
            let themeHint = rawCap.replace(/https?:\/\/[^\s<>()"']+/ig, " ").replace(/(^|[\s#@.,;:!?])insp\w*/ig, " ").replace(/[#@]/g, " ").replace(/\s+/g, " ").trim();
            if (themeHint) themeHint = themeHint.charAt(0).toUpperCase() + themeHint.slice(1);
            const inspMediaId = msg.type === "image" ? (msg.image && msg.image.id)
              : msg.type === "document" ? (msg.document && msg.document.id)
              : msg.type === "video" ? (msg.video && msg.video.id) : null;
            try {
              const media = (inspMediaId && WA_TOKEN) ? await fetchMedia(inspMediaId) : null;
              if (media && /^image\//.test(media.mime)) {
                const r = await addInspirationImageBuffer(db, { buf: Buffer.from(media.b64, "base64"), mime: media.mime, title: themeHint || "", theme: themeHint || null });
                theme = (r && r.theme) || theme;
              } else if (inspUrl) {
                const r = await addInspirationLink(db, { url: inspUrl, theme: themeHint || null });
                theme = (r && r.theme) || theme;
              }
            } catch (e) { console.error("wa-insp:", e.message); }
            await db.from("sources").update({ processed: true, summary: "Inspiratie · " + theme }).eq("id", source.id);
            try { await sendToAll(db, { title: "Inspiratie", body: "Toegevoegd · " + theme, url: "/" }); } catch (_) {}
            processed++;
            continue;
          }

          // Foto/document doorgestuurd? Download de media en laat Claude die bekijken.
          // Lukt dat niet (geen token), dan val terug op de tekst-extractie.
          let items = [], summary = "", contacts = [], usage = null;
          const mediaId = msg.type === "image" ? (msg.image && msg.image.id)
                        : msg.type === "document" ? (msg.document && msg.document.id) : null;
          if (mediaId && WA_TOKEN && anthropic) {
            const caption = (msg.type === "image" ? (msg.image && msg.image.caption) : (msg.document && msg.document.caption)) || "";
            const media = await fetchMedia(mediaId);
            if (media) {
              try {
                const ext = (media.mime.split("/")[1] || "jpg").split(";")[0];
                const fn = (msg.type === "document" && msg.document && msg.document.filename) || ("whatsapp-" + (msg.id || Date.now()) + "." + ext);
                const bytes = Buffer.from(media.b64, "base64");
                const apath = source.id + "/" + fn;
                const up = await db.storage.from("intake").upload(apath, bytes, { contentType: media.mime, upsert: true });
                if (!up.error) await db.from("attachments").insert({ source_id: source.id, filename: fn, storage_path: apath, mime: media.mime, size: bytes.length });
              } catch (_) {}
              const v = await mediaExtract({ b64: media.b64, mime: media.mime, caption, sender, today, catalog, context });
              items = v.items; summary = v.reply; usage = v.usage;
            } else {
              const ex = await extractItems({ text, sender, subject: "", today, catalog, context });
              items = ex.items; summary = ex.summary; contacts = ex.contacts; usage = ex.usage;
            }
          } else {
            const ex = await extractItems({ text, sender, subject: "", today, catalog, context });
            items = ex.items; summary = ex.summary; contacts = ex.contacts; usage = ex.usage;
          }
          if (usage) await logUsage(db, { source: "whatsapp", ...usage });
          if (items && items.length) {
            await db.from("items").insert(items.map(it => ({
              project_id: it.project_id || null, source_id: source.id, title: it.title,
              owner: it.owner || null, contact: it.contact || null, due: it.due || null,
              status: ["todo", "doing", "wait", "done"].includes(it.status) ? it.status : "todo",
            })));
          }
          const msgProject = (items.find(it => it.project_id) || {}).project_id || null;
          try { await saveContacts(db, contacts, source.id, msgProject); } catch (_) {}
          await db.from("sources").update({ processed: true, summary: summary || null, ...(msgProject ? { project_id: msgProject } : {}) }).eq("id", source.id);
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
