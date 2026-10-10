// Loft Spinozastraat: agendafeed voor Agenda op Mac en iPhone (abonnement, geen Mac nodig).
// GET /api/loft-ical?platform=airbnb|booking|schoonmaak&t=<token>  (token staat in loft_instellingen.ical_token)
// Eén kalender per platform, zodat Airbnb rood en Booking blauw kan zijn.
import { createClient } from "@supabase/supabase-js";
import { icsVanDagen, icsSchoonmaak } from "../lib/loft-agenda.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  const q = req.query || {};
  const platform = String(q.platform || "");
  if (!["airbnb", "booking", "schoonmaak"].includes(platform)) return res.status(400).json({ error: "platform moet airbnb, booking of schoonmaak zijn" });
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: inst } = await db.from("loft_instellingen").select("ical_token").eq("id", "main").maybeSingle();
    const token = (inst && inst.ical_token) || "";
    if (!token) return res.status(500).json({ error: "geen ical_token in loft_instellingen" });
    if (String(q.t || "") !== token) return res.status(403).json({ error: "geen toegang" });
    const vanaf = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await db.from("loft_dagen").select("datum,status,gast,gasten,code,url,aankomst").gte("datum", vanaf).order("datum");
    if (error) throw new Error(error.message);
    const ics = platform === "schoonmaak" ? icsSchoonmaak(data || []) : icsVanDagen(data || [], platform, platform === "airbnb" ? "Verhuur Airbnb" : "Verhuur Booking");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(ics);
  } catch (e) {
    console.error("loft-ical:", e.message);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
