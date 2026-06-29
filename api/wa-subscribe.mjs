// Eenmalige hulproute: abonneer deze app op het WhatsApp Business Account (subscribed_apps).
// Dit is de laatste schakel voor de Cloud API: zonder deze koppeling stuurt Meta inkomende
// berichten niet door naar onze webhook (/api/intake), ook al staan callback-URL en
// veld-abonnement goed. Gebruikt de WHATSAPP_TOKEN die al in Railway staat.
const TOKEN = (process.env.WHATSAPP_TOKEN || "").trim();
const SECRET = (process.env.OPDRACHT_SECRET || process.env.CRON_SECRET || "begeister-opdracht-2026").trim();
const FIXED = "begeister-opdracht-2026";
const DEFAULT_WABA = "1560729335721168"; // asset_id uit WhatsApp Manager
const GRAPH = "https://graph.facebook.com/v21.0/";

export default async function handler(req, res) {
  const q = req.query || {};
  const secret = (q.secret || "").toString().trim();
  if (!(secret === SECRET || secret === FIXED)) return res.status(401).json({ error: "unauthorized" });
  if (!TOKEN) return res.status(500).json({ error: "geen WHATSAPP_TOKEN in omgeving" });
  const waba = (q.waba || DEFAULT_WABA).toString().trim();
  try {
    const sub = await fetch(GRAPH + waba + "/subscribed_apps", {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN },
    }).then(r => r.json());
    const list = await fetch(GRAPH + waba + "/subscribed_apps", {
      headers: { Authorization: "Bearer " + TOKEN },
    }).then(r => r.json());
    return res.status(200).json({ ok: true, waba, subscribe: sub, current: list });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
