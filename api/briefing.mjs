// L9 — "Zet op een rijtje". De AI leest alles wat de app van één project weet
// (open taken, feiten, afspraken, wacht-op, geld, korte bronnen) en maakt er een
// helder, leesbaar overzicht van met de open eindjes eruit gelicht. De AI verzint
// niets en maakt niets aan — het is puur een overzicht om op te bouwen naar een draaiboek.
import Anthropic from "@anthropic-ai/sdk";
import { createMessage } from "../lib/airetry.mjs";
import { logUsage } from "../lib/usage.mjs";
import { BEGEISTER_REGELS } from "../lib/ai-regels.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

const SYSTEM = `Je bent de productie-assistent van Begeister (licht, decor, events).
Je krijgt ALLES wat de app van één project weet. Maak er een helder, kort overzicht van dat
Jeroen of Marlon in 20 seconden overzicht geeft: waar staan we, wat moet er nog, wat weten we,
wat is er afgesproken, en — belangrijk — welke OPEN EINDJES er zijn (ontbrekende info,
tegenstrijdigheden, dingen die te lang blijven liggen, of dingen die duidelijk nog geregeld
moeten worden maar nergens als taak staan).

Regels:
- Verzin NIETS. Gebruik alleen de meegegeven gegevens. Weet je iets niet, benoem het als open eindje.
- Kort en concreet. Nederlands. Geen lege beleefdheden.
- "waar_staan_we" = 1 à 2 zinnen over de stand van zaken.
- "secties" = de logische blokken die er zijn (laat een blok weg als er niks voor is). Gebruik
  titels als "Nog te doen", "Wat we weten", "Komende afspraken", "Wacht op", "Geld".
- "open_eindjes" = de scherpe lijst van wat nog onduidelijk of onaf is. Dit is het waardevolste deel.

Antwoord ALLEEN met geldige JSON:
{"waar_staan_we":"...","secties":[{"titel":"Nog te doen","punten":["..."]}],"open_eindjes":["..."]}
` + BEGEISTER_REGELS;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { client = "", project = "", today = "", taken = [], feiten = [], afspraken = [], wacht = [], geld = null, bronnen = [] } = req.body || {};
    if (!anthropic) return res.status(200).json({ error: "AI staat uit" });

    const L = (arr) => (arr && arr.length) ? arr.map(x => "- " + x).join("\n") : "(geen)";
    const user = `PROJECT: ${client}${project ? " · " + project : ""}
VANDAAG: ${today}

OPEN TAKEN:
${L(taken)}

WAT WE WETEN (feiten):
${L(feiten)}

AFSPRAKEN (komend):
${L(afspraken)}

WACHT OP:
${L(wacht)}

GELD:
${geld ? ("- projectprijs: " + (geld.prijs ?? "?") + " · inkoop: " + (geld.inkoop ?? "?") + " · marge: " + (geld.marge ?? "?") + (geld.openstaand != null ? " · openstaand: " + geld.openstaand : "")) : "(onbekend)"}

RECENTE BRONNEN (korte samenvattingen):
${L(bronnen)}

Geef het overzicht als JSON.`;

    const resp = await createMessage(anthropic, {
      model: MODEL, max_tokens: 1600, system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    try {
      await logUsage(null, {
        source: "briefing", model: MODEL,
        inputTokens: resp?.usage?.input_tokens || 0,
        outputTokens: resp?.usage?.output_tokens || 0,
        webSearches: 0,
      });
    } catch (_) {}
    const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
    let out = { waar_staan_we: "", secties: [], open_eindjes: [] };
    try {
      const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      out = {
        waar_staan_we: String(p.waar_staan_we || "").trim(),
        secties: Array.isArray(p.secties) ? p.secties.filter(s => s && s.titel && Array.isArray(s.punten) && s.punten.length) : [],
        open_eindjes: Array.isArray(p.open_eindjes) ? p.open_eindjes.map(x => String(x).trim()).filter(Boolean) : [],
      };
    } catch (_) {}
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
