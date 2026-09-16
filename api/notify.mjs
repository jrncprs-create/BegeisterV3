// Stuurt een melding naar de PARTNER (de ander), niet naar de actor zelf.
import { createClient } from "@supabase/supabase-js";
import { sendToAll, sendToWho } from "../lib/push.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { actor = "", body = "", url = "/", to = null, title = "Begeister" } = req.body || {};
    if (!body) return res.status(200).json({ ok: true, sent: 0 });
    // `to` gezet (bv. bij @mention) → alleen naar die persoon; anders naar de partner (exclude actor).
    const hasTo = to && (Array.isArray(to) ? to.length : String(to).trim());
    const r = hasTo
      ? await sendToWho(db, { title, body, url }, to)
      : await sendToAll(db, { title, body, url }, actor);
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
