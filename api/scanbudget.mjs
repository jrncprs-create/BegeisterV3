// "Budget uit bronnen" — leest de aan een project gekoppelde bronnen (mails, appjes,
// spraaknotities) en laat Claude er een projectprijs (wat Begeister factureert) en/of een
// klantbudget (wat de klant beschikbaar heeft) uit voorstellen. Vult NIETS automatisch in:
// geeft alleen een voorstel + bewijsregel terug; de gebruiker bevestigt in de app.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createMessage } from "../lib/airetry.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const SYSTEM = `Je bent de financieel-assistent van Begeister (licht, decor en event-productie).
Je krijgt de tekst van bronnen (mails, appjes, spraaknotities) die aan één project horen.
Zoek er twee bedragen uit:

1. projectprijs = het bedrag dat BEGEISTER voor dit project rekent/offreert/factureert (de omzet, excl. btw indien duidelijk).
2. budget = het bedrag dat de KLANT beschikbaar heeft voor dit project ("we hebben X budget", "budget circa X").

Regels:
- Verzin niets. Alleen bedragen die echt in de tekst staan en duidelijk over het HELE project gaan.
- Negeer losse inkoop-/kostenposten (bv. "2 lichtmannen voor 500", "kabel €21") — dat is geen projectprijs of budget.
- Een bedrag als "5300" of "€5.300" → 5300. "40.000-50.000" → neem de ONDERgrens (40000) en noem de marge in het bewijs.
- Kun je een bedrag niet met redelijke zekerheid vinden, geef dan null voor dat veld.
- "evidence" = het korte, letterlijke tekstfragment (max ~15 woorden) waar het bedrag uit komt, mét wie het zei indien bekend.
- "confidence" = "hoog" | "midden" | "laag".
- Geef ALLEEN geldige JSON terug, geen uitleg eromheen.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { project_id = "" } = req.body || {};
    if (!project_id) return res.status(400).json({ error: "geen project_id" });
    if (!anthropic) return res.status(200).json({ error: "no-ai-key", message: "AI staat uit (ANTHROPIC_API_KEY ontbreekt)." });

    const db = supa();
    // 1) Project ophalen.
    const pr = await db.from("projects").select("id,client,project,projectprijs,budget,btw").eq("id", project_id).single();
    const p = pr.data;
    if (!p) return res.status(404).json({ error: "project niet gevonden" });

    // 2) Bronnen verzamelen: direct gekoppeld (sources.project_id) + via items (items.source_id).
    const srcMap = new Map();
    try {
      const d = await db.from("sources").select("id,sender,subject,body,received_at").eq("project_id", project_id).limit(40);
      (d.data || []).forEach(s => srcMap.set(s.id, s));
    } catch (_) {}
    try {
      const its = await db.from("items").select("source_id").eq("project_id", project_id).limit(400);
      const sids = [...new Set((its.data || []).map(i => i.source_id).filter(Boolean))].filter(id => !srcMap.has(id));
      if (sids.length) {
        const d2 = await db.from("sources").select("id,sender,subject,body,received_at").in("id", sids).limit(40);
        (d2.data || []).forEach(s => srcMap.set(s.id, s));
      }
    } catch (_) {}

    const sources = [...srcMap.values()]
      .filter(s => (s.body || "").trim().length > 2)
      .sort((a, b) => String(b.received_at || "").localeCompare(String(a.received_at || "")));

    if (!sources.length) {
      return res.status(200).json({ projectprijs: null, budget: null, sources: 0, note: "Geen gekoppelde bronnen met tekst gevonden voor dit project." });
    }

    // 3) Tekstblok bouwen (gecapt op ~14000 tekens).
    let blob = "", used = 0;
    for (const s of sources) {
      const chunk = `— ${s.sender || "onbekend"}${s.subject ? " · " + s.subject : ""}:\n${(s.body || "").replace(/\s+/g, " ").trim().slice(0, 2400)}\n\n`;
      if (used + chunk.length > 14000) break;
      blob += chunk; used += chunk.length; if (used >= 14000) break;
    }

    const user = `PROJECT: ${p.client || ""} · ${p.project || ""}
Huidige projectprijs in de app: ${p.projectprijs != null && p.projectprijs !== "" ? "€" + p.projectprijs : "(leeg)"}
Huidig klantbudget in de app: ${p.budget != null && p.budget !== "" ? "€" + p.budget : "(leeg)"}

BRONNEN VAN DIT PROJECT:
"""
${blob}
"""

Geef JSON in exact dit formaat:
{
  "projectprijs": null,
  "projectprijs_evidence": "",
  "budget": null,
  "budget_evidence": "",
  "confidence": "laag",
  "note": "één zin uitleg als beide null zijn, anders leeg"
}`;

    const resp = await createMessage(anthropic, {
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed = {};
    try { parsed = JSON.parse(json); } catch (_) { return res.status(200).json({ projectprijs: null, budget: null, sources: sources.length, note: "Kon geen duidelijk bedrag uit de bronnen halen." }); }

    const num = v => { if (v == null || v === "") return null; const n = Number(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; };
    return res.status(200).json({
      projectprijs: num(parsed.projectprijs),
      projectprijs_evidence: (parsed.projectprijs_evidence || "").toString().slice(0, 200),
      budget: num(parsed.budget),
      budget_evidence: (parsed.budget_evidence || "").toString().slice(0, 200),
      confidence: (parsed.confidence || "").toString(),
      note: (parsed.note || "").toString().slice(0, 200),
      sources: sources.length,
    });
  } catch (e) {
    console.error("scanbudget:", e.message);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
