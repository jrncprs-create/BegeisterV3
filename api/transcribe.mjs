// Spraak-intake: een in-app opgenomen spraakbericht opslaan in Supabase + transcriberen.
// Claude/Anthropic kan geen audio omzetten naar tekst; daarom loopt de transcriptie via
// Groq Whisper (whisper-large-v3-turbo — snel, goedkoop, goed Nederlands). De OpenAI-
// compatibele endpoint maakt later wisselen makkelijk.
//
// Flow: audio (base64) → opslaan in de 'intake'-bucket → bron-rij aanmaken →
// transcriberen → extractItems() voor taak-suggesties → alles teruggeven aan de app,
// die het als bewerkbaar transcript in 'In afwachting' toont (de gebruiker splitst zelf in taken).
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { extractItems } from "../intake/extract.mjs";
import { logUsage } from "../lib/usage.mjs";
import { transcribeAudio, hasTranscription } from "../lib/transcribe.mjs";

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Bestandsextensie afleiden uit het mime-type dat de browser meestuurt (iOS = mp4/m4a, Chrome = webm).
function extFromMime(mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  return "m4a";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { b64 = "", mime = "", filename = "", who = "", today = "", dates = "", catalog = [], context = "" } = req.body || {};
    const data = String(b64 || "").replace(/^data:[^;]+;base64,/, "");
    if (!data) return res.status(400).json({ error: "geen audiodata" });
    if (!hasTranscription()) {
      return res.status(200).json({
        error: "no-transcription-key",
        message: "Transcriptie staat nog niet aan: zet GROQ_API_KEY in Railway om spraak automatisch uit te werken.",
        transcript: "", items: [], summary: "",
      });
    }

    const db = supa();
    const buf = Buffer.from(data, "base64");
    const ext = extFromMime(mime);
    const fn = filename || ("spraak-" + Date.now() + "." + ext);

    // 1) Bron-rij vast aanmaken, zodat het spraakbericht sowieso bewaard blijft (ook als transcriptie faalt).
    let source = null;
    try {
      const r = await db.from("sources").insert({
        channel: "voice", sender: who || "Spraak", subject: "",
        body: "[spraakbericht — wordt uitgewerkt…]",
        message_id: "voice-" + crypto.randomUUID(),
        received_at: new Date(), processed: false,
      }).select().single();
      source = r.data || null;
    } catch (_) {}
    const sourceId = source ? source.id : null;

    // 2) Audio opslaan in de 'intake'-bucket (zelfde bucket als WhatsApp-media).
    let audioPath = null;
    try {
      audioPath = (sourceId || "voice") + "/" + fn;
      const up = await db.storage.from("intake").upload(audioPath, buf, { contentType: mime || "audio/m4a", upsert: true });
      if (up.error) audioPath = null;
    } catch (_) { audioPath = null; }

    // 3) Transcriberen.
    let transcript = "";
    try {
      transcript = await transcribeAudio(buf, mime, fn);
    } catch (e) {
      console.error("transcribe-groq:", e.message);
      if (sourceId) { try { await db.from("sources").update({ body: "[spraakbericht — transcriptie mislukte]" }).eq("id", sourceId); } catch (_) {} }
      return res.status(200).json({ error: "transcription-failed", message: "Transcriberen lukte niet: " + e.message, transcript: "", items: [], source_id: sourceId });
    }
    if (!transcript) {
      if (sourceId) { try { await db.from("sources").update({ body: "[spraakbericht — geen spraak herkend]", processed: true }).eq("id", sourceId); } catch (_) {} }
      return res.status(200).json({ transcript: "", items: [], summary: "Geen spraak herkend in de opname.", source_id: sourceId });
    }

    // 4) Taak-suggesties uit het transcript (zelfde extractie als mail/drop). Faalt de AI (Anthropic-storing),
    //    dan krijgen we nog steeds het volledige transcript terug — de gebruiker splitst dan zelf.
    let ex = { items: [], summary: "", contacts: [], client: "", project: "", type: "", from: "", category: "", subject: "", usage: null };
    try {
      ex = await extractItems({ text: transcript, sender: who || "Spraak", subject: "spraakbericht", today, catalog, context });
    } catch (e) { console.error("transcribe-extract:", e.message); }
    if (ex.usage) { try { await logUsage(db, { source: "voice", ...ex.usage }); } catch (_) {} }

    // 5) Bron bijwerken met het volledige transcript + attachment koppelen.
    if (sourceId) {
      try { await db.from("sources").update({ body: transcript, summary: ex.summary || null, processed: true }).eq("id", sourceId); } catch (_) {}
      if (audioPath) { try { await db.from("attachments").insert({ source_id: sourceId, filename: fn, storage_path: audioPath, mime: mime || "audio/m4a", size: buf.length, transcript }); } catch (_) {} }
    }

    return res.status(200).json({
      source_id: sourceId,
      audio_path: audioPath,
      transcript,
      summary: ex.summary || "",
      items: Array.isArray(ex.items) ? ex.items : [],
      client: ex.client || "", project: ex.project || "",
      type: ex.type || "", from: ex.from || "", category: ex.category || "", subject: ex.subject || "",
    });
  } catch (e) {
    console.error("transcribe:", e.message);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
