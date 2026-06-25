// Genereert één verse, persoonsgebonden one-liner (AI-humor) voor het beginscherm.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { who = "", partner = "", busy = "", openCount = 0, partnerOpen = 0, partnerDone = [], day = "" } = req.body || {};
    if (!anthropic) return res.status(200).json({ text: "" });
    const done = Array.isArray(partnerDone) ? partnerDone.filter(Boolean).slice(0, 4) : [];
    const sys = `Schrijf ÉÉN korte, warme en licht grappige one-liner in het Nederlands, gericht aan ${who} (werkt samen met ${partner}) bij Begeister (licht, decor en events).
Stijl: droge, speelse AI-humor. Persoonlijk. Maximaal ~22 woorden. Geen emoji. Geen aanhalingstekens. Varieer sterk, nooit cliché.
Je mag riffen op precies één van deze hoeken:
- de drukte van de week (${busy}; ${openCount} open taken, ${partnerOpen} bij ${partner});
- het weer (verzin iets aannemelijk Nederlands);
- een nieuwtje over ${partner} qua werk${done.length ? ` (zojuist afgevinkt: ${done.join("; ")})` : ""}.
Spreek ${who} direct aan met de naam. Geef ALLEEN de zin terug, niets eromheen.`;
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 120, system: sys,
      messages: [{ role: "user", content: `Vandaag is het ${day}. Geef een frisse one-liner voor ${who}.` }],
    });
    const text = resp.content.map(b => (b.type === "text" ? b.text : "")).join("").trim().replace(/^["']+|["']+$/g, "");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
