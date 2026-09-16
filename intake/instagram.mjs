// Instagram-berichten-webhook: gedeelde posts / DM's naar het inspiratie-account
// belanden in Inspiratie (AI bepaalt het thema). Hergebruikt intake/inspiration.mjs.
import { supa, addInspirationImageUrl, addInspirationLink } from "./inspiration.mjs";

const VERIFY_TOKEN = (process.env.WHATSAPP_VERIFY_TOKEN || "begeister-wa-2026").trim();
const URL_RE = /https?:\/\/[^\s<>()"']+/i;

export function verifyChallenge(q) {
  if (q && q["hub.mode"] === "subscribe" && q["hub.verify_token"] === VERIFY_TOKEN) return q["hub.challenge"];
  return null;
}

export async function handleInstaEvent(body) {
  if (!body || body.object !== "instagram") return { skipped: true };
  const db = supa();
  let processed = 0;
  for (const entry of (body.entry || [])) {
    const events = entry.messaging || entry.changes || [];
    for (const ev of events) {
      try {
        const msg = ev.message || (ev.value && ev.value.message);
        if (!msg || msg.is_echo) continue;
        // 1) bijlagen: gedeelde post / reel / foto → media-URL ophalen en als beeld opslaan
        for (const att of (msg.attachments || [])) {
          const p = att.payload || {};
          if (p.url) { await addInspirationImageUrl(db, { url: p.url, title: p.title || "" }); processed++; }
          else if (p.link) { await addInspirationLink(db, { url: p.link }); processed++; }
        }
        // 2) tekst met een link (bv. een geplakte Instagram-/web-URL)
        if (msg.text) { const m = String(msg.text).match(URL_RE); if (m) { await addInspirationLink(db, { url: m[0] }); processed++; } }
      } catch (e) { console.error("insta-msg:", e.message); }
    }
  }
  return { processed };
}
