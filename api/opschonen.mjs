// L8b — Grote schoonmaak. De AI kijkt naar ALLE open taken en stelt per taak voor:
// houden, verwijderen (verzonnen/onzin), samenvoegen (met andere taken), of omzetten
// naar een FEIT of naar de SCOPE (omschrijving). De gebruiker beslist op een reviewscherm.
import Anthropic from "@anthropic-ai/sdk";
import { createMessage } from "../lib/airetry.mjs";
import { logUsage } from "../lib/usage.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

const SYSTEM = `Je bent de opschoon-assistent van Begeister (licht, decor en event-productie).
Je krijgt een lijst OPEN TAKEN (per project). Je taak: de lijst kritisch tegen het licht houden en
per taak een VOORSTEL doen. Je verzint niets en je verandert nooit zelf iets — je stelt alleen voor.

Mogelijke voorstellen (kies er precies één per taak):
- "houden": de taak is een echte, concrete taak en staat goed. (Geef deze GEEN reden, laat weg uit de output tenzij hij ergens bij hoort.)
- "verwijderen": de taak is geen echte taak. Bv. een verzonnen controle-taak bij een specificatie
  ("controleer of de maten kloppen"), een dubbele, iets wat al gedaan is, of een lege/onzinnige regel.
- "feit": het is eigenlijk een FEIT (maat, specificatie, aantal, materiaallijst, tijd, locatie, keuze),
  geen taak. Geef bij "naar" de korte feitzin.
- "scope": het beschrijft wat Begeister doet ("wij doen licht en opbouw"), hoort in de projectomschrijving.
- "samenvoegen": deze taak overlapt sterk met één of meer andere taken uit dezelfde lijst.
  Geef bij "met" de id's van de andere taken en bij "naar" één heldere samengevoegde taaktitel.
  Kies één taak als "hoofd" (die blijft, aangepast); de andere worden bij toepassen verwijderd.

Wees terughoudend: stel alleen iets voor als je het echt beter maakt. Bij twijfel: "houden" en laat 'm weg.
Geef ALLEEN taken terug waarvoor je iets anders dan "houden" voorstelt.

Antwoord ALLEEN met geldige JSON:
{"voorstellen":[
  {"id":"taak-id","actie":"verwijderen","reden":"korte reden"},
  {"id":"taak-id","actie":"feit","naar":"bogentent: 6,20 x 2,44 / 4,50 m","reden":"is een maat"},
  {"id":"taak-id","actie":"scope","naar":"wij verzorgen licht en opbouw"},
  {"id":"hoofd-id","actie":"samenvoegen","met":["id2","id3"],"naar":"samengevoegde titel","reden":"overlappen"}
]}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { items = [], context = "" } = req.body || {};
    if (!anthropic) return res.status(200).json({ voorstellen: [] });
    if (!items.length) return res.status(200).json({ voorstellen: [] });

    const perProject = {};
    for (const it of items) {
      const k = (it.client || "—") + " · " + (it.project || "—");
      (perProject[k] = perProject[k] || []).push(it);
    }
    const lijst = Object.entries(perProject).map(([k, arr]) =>
      `PROJECT: ${k}\n` + arr.map(it => `- ${it.id} | ${it.title}${it.owner ? " (" + it.owner + ")" : ""}${it.due ? " [deadline " + it.due + "]" : ""}${it.status === "wait" ? " [wacht]" : ""}`).join("\n")
    ).join("\n\n");

    const user = `${context ? "VASTE CONTEXT (team/bedrijf):\n" + context + "\n\n" : ""}OPEN TAKEN (per project):\n${lijst}\n\nGeef je voorstellen als JSON.`;

    const resp = await createMessage(anthropic, {
      model: MODEL, max_tokens: 2600, system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    try {
      await logUsage(null, {
        source: "opschonen", model: MODEL,
        inputTokens: resp?.usage?.input_tokens || 0,
        outputTokens: resp?.usage?.output_tokens || 0,
        webSearches: 0,
      });
    } catch (_) {}
    const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
    let voorstellen = [];
    try {
      const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      voorstellen = Array.isArray(p.voorstellen) ? p.voorstellen : [];
    } catch (_) {}
    const geldig = new Set(items.map(it => String(it.id)));
    voorstellen = voorstellen.filter(v =>
      v && geldig.has(String(v.id)) &&
      ["verwijderen", "feit", "scope", "samenvoegen"].includes(v.actie)
    );
    return res.status(200).json({ voorstellen });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
