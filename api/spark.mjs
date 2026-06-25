// Genereert één verse, persoonsgebonden one-liner (AI-humor) voor het beginscherm.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { who = "", partner = "", busy = "", openCount = 0, partnerOpen = 0, partnerDone = [], projects = [] } = req.body || {};
    if (!anthropic) return res.status(200).json({ text: "" });
    const projlist = (projects || []).map(p => typeof p === "string" ? p : `${p.client || ""}${p.project ? " · " + p.project : ""}`).filter(Boolean).join(", ") || "(geen)";
    const sys = `Schrijf ÉÉN korte, INSPIRERENDE one-liner in het Nederlands, gericht aan ${who} (werkt samen met ${partner}) bij Begeister — een studio die met licht, decor en events mooie dingen maakt.
Toon: warm, oprecht en inspirerend, met trots op vakmanschap. Wissel af tussen deze invalshoeken:
- trots op het maken ("vandaag bouwen jullie iets dat er gisteren nog niet was");
- poëtisch over licht & sfeer ("jullie werken met het mooiste materiaal: licht");
- creativiteit & verbeelding ("het mooiste idee bestaat nog niet — tot jij het bedenkt");
- impact op het publiek / herinneringen maken;
- een oprecht talent-compliment (oog voor detail, gevoel voor sfeer);
- rust & focus voor de dag;
- teamspirit (jullie samen);
- spreukachtig-krachtig;
- af en toe droog-speels maar altijd opbouwend.
Regels: maximaal ~22 woorden. Geen emoji. Geen aanhalingstekens. Varieer sterk, nooit cliché.
Noem NOOIT de dag van de week (geen "maandag/donderdag/weekend") en geen datum — dat is suf.
NOOIT iets ten nadele van ${who} of ${partner} — geen sneren of competitieve vergelijkingen.
Het weer of de drukte mag HOOGSTENS een klein terloops bonusje zijn, nooit het hoofdthema.
Je MAG soms (niet altijd) een projectnaam noemen ter inspiratie. Bestaande projecten: ${projlist}.
Spreek ${who} direct aan met de naam. Geef ALLEEN de zin terug, niets eromheen.`;
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 120, system: sys,
      messages: [{ role: "user", content: `Geef een frisse, inspirerende one-liner voor ${who}. Variatie ${Math.random().toString(36).slice(2, 7)}.` }],
    });
    const text = resp.content.map(b => (b.type === "text" ? b.text : "")).join("").trim().replace(/^["']+|["']+$/g, "");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
