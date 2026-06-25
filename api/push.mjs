// Handmatige/triggerbare push-endpoint (beveiligd met CRON_SECRET).
import { createClient } from "@supabase/supabase-js";
import { sendToAll } from "../lib/push.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const auth = req.headers["authorization"];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { title = "Begeister", body = "", url = "/" } = req.body || {};
    const r = await sendToAll(db, { title, body, url });
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
