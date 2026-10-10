// Loft Spinozastraat: acties vanuit de Loft-tab. Alleen voor Jeroen (team + e-mail).
//  besluit   {id, status: 'ja'|'nee'}           voorstel goed- of afkeuren
//  herschrijf{id, instructie}                   conceptantwoord opnieuw schrijven op basis van één regel van Jeroen
//  verstuur  {id}                               conceptantwoord in de wachtrij zetten; de cloud-agent mailt het binnen het uur via Gmail
//  instellingen {weekdag, weekend, minimum, maximum, langverblijf_pct, leeg_dagen}
// De app verstuurt zelf geen mail: geen extra wachtwoorden in Railway, één koppeling minder.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createMessage } from "../lib/airetry.mjs";
import { logUsage } from "../lib/usage.mjs";
import { MODEL_SLIM as MODEL } from "../lib/models.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const JEROEN = "jeroen@begeister.nl";

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
function fout(res, code, tekst) { return res.status(code).json({ error: tekst }); }

async function isJeroen(db, req) {
  const kop = String(req.headers.authorization || "");
  const token = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return null;
  if (String(data.user.email || "").toLowerCase() !== JEROEN) return null;
  const { data: team } = await db.from("team_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return team ? data.user : null;
}

const SYSTEM = `Je schrijft namens Jeroen, host van een kamer (loft met grachtzicht, gedeelde badkamer, kitchenette) aan de Spinozastraat in Amsterdam, een antwoord aan een gast op Airbnb of Booking.
Regels:
- Schrijf in de taal van de gast. Kort: 2 tot 6 zinnen. Warm, direct, zonder kantoortaal en zonder overdrijving.
- Begin met "Hi <voornaam>," en sluit af met "Jeroen" op een eigen regel.
- Beantwoord precies wat gevraagd is. Weet je iets niet, zeg dan dat Jeroen erop terugkomt. Verzin niets.
- Vaste feiten: aankomst vanaf 16:00, vertrek voor 12:00, bagage kan in overleg eerder of later, trap is steil en smal, geen lift, badkamer gedeeld met Jeroen, geen ontbijt, kitchenette met minikoelkast, oven en waterkoker, snelle wifi.
- Geef ALLEEN de antwoordtekst terug.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return fout(res, 405, "method not allowed");
  const db = supa();
  const user = await isJeroen(db, req);
  if (!user) return fout(res, 403, "alleen Jeroen");
  const { action = "", id = "", status = "", instructie = "" } = req.body || {};
  try {
    if (action === "besluit") {
      if (!id || !["ja", "nee"].includes(status)) return fout(res, 400, "id of status ontbreekt");
      const { error } = await db.from("loft_voorstellen").update({ status, besloten_op: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
      await db.from("loft_log").insert({ tekst: "Voorstel " + id + ": " + status });
      return res.json({ ok: true });
    }

    if (action === "instellingen") {
      const v = req.body.instellingen || {};
      const toegestaan = ["weekdag", "weekend", "minimum", "maximum", "langverblijf_pct", "leeg_dagen"];
      const upd = {}; for (const k of toegestaan) if (v[k] != null) upd[k] = Number(v[k]);
      if (upd.minimum > 0 && upd.maximum > 0 && upd.minimum > upd.maximum) return fout(res, 400, "minimum is hoger dan maximum");
      upd.bijgewerkt = new Date().toISOString();
      const { error } = await db.from("loft_instellingen").upsert({ id: "main", ...upd });
      if (error) throw new Error(error.message);
      await db.from("loft_log").insert({ tekst: "Grenzen aangepast: " + JSON.stringify(upd) });
      return res.json({ ok: true });
    }

    const { data: v, error: ve } = await db.from("loft_voorstellen").select("*").eq("id", id).maybeSingle();
    if (ve) throw new Error(ve.message);
    if (!v) return fout(res, 404, "voorstel niet gevonden");

    if (action === "herschrijf") {
      if (!anthropic) return fout(res, 500, "AI staat uit (geen ANTHROPIC_API_KEY)");
      const prompt = `GAST: ${v.gast || "onbekend"} via ${v.platform || "onbekend"}${v.datums ? " (" + v.datums + ")" : ""}
VRAAG VAN DE GAST:
"""
${String(v.vraag || "").slice(0, 6000)}
"""
HUIDIG CONCEPT:
"""
${String(v.concept || "")}
"""
WAT JEROEN WIL ZEGGEN (één regel, dit is leidend): ${String(instructie || "").slice(0, 500)}`;
      const resp = await createMessage(anthropic, { model: MODEL, max_tokens: 500, system: SYSTEM, messages: [{ role: "user", content: prompt }] });
      try { await logUsage(db, { source: "loft", model: MODEL, inputTokens: resp?.usage?.input_tokens || 0, outputTokens: resp?.usage?.output_tokens || 0, webSearches: 0 }); } catch (_) {}
      const concept = resp.content.map(b => (b.type === "text" ? b.text : "")).join("").trim();
      if (!concept) throw new Error("geen concept gekregen");
      const { error } = await db.from("loft_voorstellen").update({ concept }).eq("id", id);
      if (error) throw new Error(error.message);
      return res.json({ ok: true, concept });
    }

    if (action === "verstuur") {
      if (v.soort !== "bericht") return fout(res, 400, "alleen berichten kunnen verstuurd worden");
      if (!v.reply_to) return fout(res, 400, "geen antwoordadres bij dit bericht");
      if (!v.concept) return fout(res, 400, "geen concept om te versturen");
      const { error } = await db.from("loft_voorstellen").update({ status: "ja", besloten_op: new Date().toISOString(), resultaat: "in wachtrij" }).eq("id", id);
      if (error) throw new Error(error.message);
      await db.from("loft_log").insert({ tekst: "Antwoord aan " + (v.gast || v.reply_to) + " (" + (v.platform || "?") + ") in de wachtrij; de agent verstuurt het binnen het uur" });
      return res.json({ ok: true, wachtrij: true });
    }

    return fout(res, 400, "onbekende actie: " + action);
  } catch (e) {
    console.error("loft:", e.message);
    return fout(res, 500, String(e.message || e));
  }
}
