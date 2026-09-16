// Sorteert bestanden in een vaste mappenlijst (AI-classificatie). Verzint geen nieuwe namen.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";

// Zes vaste mappen per project — dezelfde overal (Bestanden, portaal, Dropbox).
const PROJ = ["Briefing","Concept & ontwerp","Techniek","Beeld","Financieel","Oplevering"];
const CLIENT = ["Contracten","Huisstijl","Logo's","Financieel","Overig"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { files = [], catalog = [] } = req.body || {};
    if (!files.length) return res.status(200).json({ map: {}, moves: {} });
    if (!anthropic) {
      const m = {}; files.forEach(f => { m[f.id] = (f.scope === "client") ? "Overig" : "Concept"; });
      return res.status(200).json({ map: m, moves: {} });
    }
    // Catalogus van bekende klanten/projecten (alleen hieruit mag de AID kiezen voor verplaatsen).
    const cats = (catalog || []).map(c => ({ client: (c.client || "").trim(), project: (c.project || "").trim(), project_id: (c.project_id || "").toString() }))
      .filter(c => c.client);
    const catTxt = cats.length
      ? cats.map(c => `- klant="${c.client}"${c.project ? ` project="${c.project}" id=${c.project_id}` : " (klant zonder project)"}`).join("\n")
      : "(geen bekende klanten)";
    const sys = `Je sorteert bestanden van een licht/decor/event-bedrijf (Begeister) in vaste mappen.

TAAK 1 — CATEGORIE: kies voor ELK bestand precies één mapnaam uit de toegestane lijst voor zijn scope. Verzin GEEN nieuwe namen.
PROJECT-mappen: ${PROJ.join(", ")}.
KLANT-mappen: ${CLIENT.join(", ")}.
Baseer je op de bestandsnaam (extensie + woorden in de naam). De zes projectmappen:
- Briefing: projectbrief, aanvraag, intake, wat de klant aanlevert ("projectbrief"/"briefing"/"aanvraag"/"intake").
- Concept & ontwerp: concept, moodboard, lichtontwerp, decor, ontwerpvoorstel ("concept"/"ontwerp"/"moodboard"/"licht"/"decor"; ook .ai/.psd/.indd designbestanden).
- Techniek: tekeningen, plattegronden, draaiboek, planning, leveranciers, techniek ("tekening"/"plattegrond"/"floorplan"/"draaiboek"/"runsheet"/"planning"/"patch"/"rigging"/"stroom").
- Beeld: foto's, referenties, video, inspiratie zonder duidelijke functie (jpg/png/heic/mp4/mov).
- Financieel: alles met geld — offerte/prijsopgave, factuur/rekening, bon/inkoop/bestelbevestiging, budget/calculatie ("offerte"/"factuur"/"invoice"/"bon"/"inkoop"/"budget"/"calculatie").
- Oplevering: eindfoto's, nazorg, aftermovie ("oplevering"/"nazorg"/"aftermovie"/"eindresultaat").
Bij twijfel: project → "Concept & ontwerp", klant → "Overig".

TAAK 2 — JUISTE KLANT: elk bestand staat nu bij een klant/project ("nu="). Bepaal of de bestandsnaam ONMISKENBAAR bij een ANDERE bekende klant/project hoort uit onderstaande lijst. Alleen dan stel je een verplaatsing voor. Kies UITSLUITEND uit de lijst — verzin nooit een klant. Twijfel je ook maar iets, of staat het bestand al goed? Laat 'move' weg. Voorbeeld: een bestand met "Begeisterung"/"Begeister" in de naam hoort bij klant "Begeister" (de eigen pitch/huisstijl van het bedrijf), niet bij een externe klant.
BEKENDE KLANTEN/PROJECTEN:
${catTxt}

Geef ALLEEN geldige JSON terug, niets eromheen, met per bestand-id een object:
{"<id>":{"cat":"<mapnaam>","move":{"client":"<exacte klantnaam of leeg>","project_id":"<id of leeg>"}}}
Laat "move" weg (of zet op null) als het bestand al goed staat of je twijfelt.`;
    const list = files.map(f => `${f.id} | scope=${f.scope || "project"} | nu="${(f.client || "?")}${f.project ? " · " + f.project : ""}" | ${(f.name || "").slice(0,120)}`).join("\n");
    const r = await anthropic.messages.create({ model: MODEL, max_tokens: 2500, system: sys, messages: [{ role: "user", content: "Bestanden:\n" + list }] });
    let txt = (r.content && r.content[0] && r.content[0].text) || "{}";
    const s = txt.indexOf("{"), e = txt.lastIndexOf("}"); if (s >= 0 && e >= 0) txt = txt.slice(s, e + 1);
    let raw = {}; try { raw = JSON.parse(txt); } catch (_) {}
    const out = {}, moves = {};
    const clientSet = new Set(cats.map(c => c.client.toLowerCase()));
    const idSet = new Set(cats.filter(c => c.project_id).map(c => c.project_id));
    files.forEach(f => {
      const entry = raw[f.id] || {};
      const allowed = (f.scope === "client") ? CLIENT : PROJ;
      let c = (typeof entry === "string") ? entry : entry.cat;
      if (!allowed.includes(c)) c = (f.scope === "client") ? "Overig" : "Concept & ontwerp";
      out[f.id] = c;
      // Verplaatsing alleen accepteren als de klant (en eventueel project_id) écht in de catalogus staat.
      const mv = entry && typeof entry === "object" ? entry.move : null;
      if (mv && mv.client) {
        const cl = String(mv.client).trim();
        const pid = String(mv.project_id || "").trim();
        const clOk = clientSet.has(cl.toLowerCase());
        const pidOk = !pid || idSet.has(pid);
        // Niet voorstellen als het al exact daar staat.
        const sameClient = (f.client || "").trim().toLowerCase() === cl.toLowerCase();
        if (clOk && pidOk && !(sameClient && (!pid || pid === (f.project_id || "")))) {
          moves[f.id] = { client: cl, project_id: pidOk ? pid : "" };
        }
      }
    });
    return res.status(200).json({ map: out, moves });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
