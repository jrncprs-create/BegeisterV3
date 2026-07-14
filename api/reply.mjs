// U8 — Antwoordconcept bij een intake-mail. De poller maakt bij nieuwe mails direct een
// concept (intake/extract.mjs geeft "reply" mee); dit endpoint maakt er één op verzoek
// voor bestaande bronnen, of vernieuwt het concept. Slaat het resultaat op in
// sources.suggest_reply en geeft het terug. Verzenden gebeurt via mailto in de app.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createMessage } from "../lib/airetry.mjs";
import { logUsage } from "../lib/usage.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function loadContext(db) {
  try {
    const { data } = await db.from("app_context").select("key, body");
    const m = {}; (data || []).forEach(r => { m[r.key] = r.body || ""; });
    let s = "";
    if (m.begeister) s += "OVER BEGEISTER:\n" + m.begeister + "\n\n";
    if (m.jeroen) s += "OVER JEROEN:\n" + m.jeroen + "\n\n";
    if (m.marlon) s += "OVER MARLON:\n" + m.marlon + "\n";
    return s.trim();
  } catch (_) { return ""; }
}

const SYSTEM = `Je schrijft namens Begeister (licht, decor en event-productie) een CONCEPT-ANTWOORD op een binnengekomen e-mail. De gebruiker leest het na, past aan en verstuurt zelf.

Regels:
- Nederlands, vriendelijk en professioneel, geen stijve kantoortaal.
- Kort: 3 tot 8 zinnen. Geen onderwerpregel, geen aanhef-placeholder-gedoe: begin met "Beste <voornaam>," of "Hoi <voornaam>," (kies wat past bij de toon van de afzender; voornaam uit de afzender halen, anders "Beste,").
- Beantwoord wat er gevraagd wordt. Weet je iets niet (prijs, beschikbaarheid, datum), zeg dan dat je erop terugkomt — verzin NIETS.
- Sluit af met "Groet," gevolgd door de naam van de gebruiker op een nieuwe regel.
- Geef ALLEEN de antwoordtekst terug, geen uitleg eromheen.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!anthropic) return res.status(200).json({ error: "AI staat uit (geen ANTHROPIC_API_KEY)." });
  try {
    const { source_id = "", who = "Jeroen", instructie = "" } = req.body || {};
    if (!source_id) return res.status(400).json({ error: "source_id ontbreekt" });
    const db = supa();
    const { data: s, error } = await db.from("sources")
      .select("id, sender, subject, body, summary, channel").eq("id", source_id).single();
    if (error || !s) return res.status(404).json({ error: "bron niet gevonden" });

    const context = await loadContext(db);
    const user = `AFZENDER: ${s.sender || "onbekend"}
ONDERWERP: ${s.subject || "(geen)"}
GEBRUIKER (ondertekenaar): ${who}
${instructie ? "EXTRA INSTRUCTIE VAN DE GEBRUIKER: " + instructie + "\n" : ""}
BERICHT:
"""
${String(s.body || s.summary || "").slice(0, 12000)}
"""`;

    const resp = await createMessage(anthropic, {
      model: MODEL, max_tokens: 700,
      system: SYSTEM + (context ? "\n\nVASTE CONTEXT (team/bedrijf):\n" + context : ""),
      messages: [{ role: "user", content: user }],
    });
    try {
      await logUsage(db, { source: "reply", model: MODEL,
        inputTokens: resp?.usage?.input_tokens || 0,
        outputTokens: resp?.usage?.output_tokens || 0, webSearches: 0 });
    } catch (_) {}
    const reply = resp.content.map(b => (b.type === "text" ? b.text : "")).join("").trim();
    if (!reply) return res.status(200).json({ error: "geen concept gekregen" });
    try { await db.from("sources").update({ suggest_reply: reply }).eq("id", s.id); } catch (_) {}
    return res.status(200).json({ reply });
  } catch (e) {
    console.error("reply:", e.message);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
