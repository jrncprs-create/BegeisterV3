// Loft Spinozastraat: agendafeed voor Agenda op Mac en iPhone (abonnement, geen Mac nodig).
// GET /api/loft-ical?platform=airbnb|booking&t=<LOFT_ICAL_TOKEN>
// Eén kalender per platform, zodat Airbnb rood en Booking blauw kan zijn.
import { createClient } from "@supabase/supabase-js";
import { icsVanDagen } from "../lib/loft-agenda.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  const token = (process.env.LOFT_ICAL_TOKEN || "").trim();
  if (!token) return res.status(500).json({ error: "LOFT_ICAL_TOKEN ontbreekt in Railway" });
  const q = req.query || {};
  if (String(q.t || "") !== token) return res.status(403).json({ error: "geen toegang" });
  const platform = String(q.platform || "");
  if (!["airbnb", "booking"].includes(platform)) return res.status(400).json({ error: "platform moet airbnb of booking zijn" });
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const vanaf = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await db.from("loft_dagen").select("datum,status,gast,gasten,code,url,aankomst").gte("datum", vanaf).order("datum");
    if (error) throw new Error(error.message);
    const ics = icsVanDagen(data || [], platform, platform === "airbnb" ? "Verhuur Airbnb" : "Verhuur Booking");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(ics);
  } catch (e) {
    console.error("loft-ical:", e.message);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
