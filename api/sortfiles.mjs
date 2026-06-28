// Sorteert bestanden in een vaste mappenlijst (AI-classificatie). Verzint geen nieuwe namen.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";

const PROJ = ["Concept","Lichtontwerp","Decor","Tekeningen","Plattegronden","Draaiboek","Planning","Leveranciers","Techniek","Offertes","Media"];
const CLIENT = ["Contracten","Huisstijl","Logo's","Facturen","Overig"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { files = [] } = req.body || {};
    if (!files.length) return res.status(200).json({ map: {} });
    if (!anthropic) {
      const m = {}; files.forEach(f => { m[f.id] = (f.scope === "client") ? "Overig" : "Concept"; });
      return res.status(200).json({ map: m });
    }
    const sys = `Je sorteert bestanden van een licht/decor/event-bedrijf (Begeister) in vaste mappen.
Kies voor ELK bestand precies één mapnaam uit de toegestane lijst voor zijn scope. Verzin GEEN nieuwe namen.
PROJECT-mappen: ${PROJ.join(", ")}.
KLANT-mappen: ${CLIENT.join(", ")}.
Baseer je op de bestandsnaam (extensie + woorden in de naam). Voorbeelden: een .ai/.psd/.indd of "logo"/"huisstijl" → Huisstijl of Logo's (klant) of Decor/Tekeningen (project); "offerte"/"quote" → Offertes; "factuur"/"invoice" → Facturen; "contract" → Contracten; "draaiboek"/"runsheet" → Draaiboek; "planning"/"schema" → Planning; "plattegrond"/"floorplan" → Plattegronden; "patch"/"rigging"/"stroom" → Techniek; beeldbestanden (jpg/png/mp4/mov) zonder duidelijke functie → Media.
Bij twijfel: project → "Concept", klant → "Overig".
Geef ALLEEN geldige JSON terug, niets eromheen: {"<id>":"<mapnaam>", ...}.`;
    const list = files.map(f => `${f.id} | scope=${f.scope || "project"} | ${(f.name || "").slice(0,120)}`).join("\n");
    const r = await anthropic.messages.create({ model: MODEL, max_tokens: 2000, system: sys, messages: [{ role: "user", content: "Bestanden:\n" + list }] });
    let txt = (r.content && r.content[0] && r.content[0].text) || "{}";
    const s = txt.indexOf("{"), e = txt.lastIndexOf("}"); if (s >= 0 && e >= 0) txt = txt.slice(s, e + 1);
    let map = {}; try { map = JSON.parse(txt); } catch (_) {}
    const out = {};
    files.forEach(f => {
      const allowed = (f.scope === "client") ? CLIENT : PROJ;
      let c = map[f.id];
      if (!allowed.includes(c)) c = (f.scope === "client") ? "Overig" : "Concept";
      out[f.id] = c;
    });
    return res.status(200).json({ map: out });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
