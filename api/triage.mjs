// Postvak In — beoordeelt een stapel niet-toegewezen bronnen in één AI-call.
// Geeft per bron een voorstel: welk project, en wat voor soort materiaal het is.
// Verzint nooit een klant: kiest uitsluitend uit de meegegeven catalogus.
import Anthropic from "@anthropic-ai/sdk";
import { createMessage } from "../lib/airetry.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";

const KINDS = ["werk", "inspiratie", "prive", "ruis"];

// Filtert het AI-antwoord: alleen bron-ids die we zelf stuurden, alleen projecten uit de
// catalogus, alleen bekende soorten. Een verzonnen klant is erger dan geen klant.
// Apart en puur, zodat dit zonder AI-call te testen is.
export function sanitize(raw, sources, cats) {
  const idSet = new Set((sources || []).map(s => String(s.id)));
  const projSet = new Set((cats || []).map(c => String(c.id ?? c.project_id ?? "")));
  const out = {};
  for (const [sid, val] of Object.entries(raw || {})) {
    if (!idSet.has(String(sid)) || !val || typeof val !== "object") continue;
    const kind = KINDS.includes(val.kind) ? val.kind : "werk";
    const pid = projSet.has(String(val.project_id || "")) ? String(val.project_id) : "";
    out[sid] = { kind, project_id: pid, reden: String(val.reden || "").slice(0, 60) };
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { sources = [], catalog = [] } = req.body || {};
    if (!sources.length) return res.status(200).json({ suggestions: {} });

    const cats = (catalog || [])
      .map(c => ({ id: String(c.project_id || ""), client: (c.client || "").trim(), project: (c.project || "").trim() }))
      .filter(c => c.id && c.client);
    if (!cats.length) return res.status(200).json({ suggestions: {}, note: "geen catalogus" });
    if (!anthropic) return res.status(200).json({ suggestions: {}, note: "geen AI-sleutel" });

    const catTxt = cats.map(c => `- ${c.id} → ${c.client}${c.project ? " · " + c.project : " (klant zonder project)"}`).join("\n");

    const sys = `Je sorteert binnengekomen berichten en bestanden van Begeister (licht, decor, event-productie) op de juiste plek.

Geef per bron:

1. "kind" — precies één van: ${KINDS.join(", ")}
   - "werk"       = hoort bij een klantopdracht of bij Begeister zelf (offerte, factuur, draaiboek, afspraak, vraag van een klant, techniek).
   - "inspiratie" = beeld, referentie, sfeer, een mooie foto of link zonder concrete actie. GEEN taak, GEEN deadline.
   - "prive"      = persoonlijk, niets met werk te maken (school van de kinderen, huurcontract, verjaardag, boodschappen, tickets, Marktplaats).
   - "ruis"       = leeg, mislukt, dubbel, nieuwsbrief, of zonder enige betekenis.

2. "project_id" — ALLEEN een id uit de catalogus hieronder, en alleen als het onmiskenbaar klopt.
   Twijfel je? Laat leeg (""). Een verkeerde koppeling is erger dan geen koppeling.
   Voor "prive" kies je een privé-klant uit de catalogus als die bestaat, anders leeg.
   Voor "inspiratie" en "ruis" laat je project_id leeg tenzij het overduidelijk bij één project hoort.

3. "reden" — maximaal 6 woorden, waarom je dit denkt. In het Nederlands.

CATALOGUS (project_id → klant · project):
${catTxt}

Antwoord ALLEEN met geldige JSON, zonder tekst eromheen:
{"<bron-id>":{"kind":"werk","project_id":"","reden":""}}`;

    const list = sources.slice(0, 60).map(s => {
      const bits = [
        `id=${s.id}`,
        `kanaal=${s.channel || "?"}`,
        s.sender ? `van="${String(s.sender).slice(0, 60)}"` : "",
        s.subject ? `onderwerp="${String(s.subject).slice(0, 80)}"` : "",
        `tekst="${String(s.body || "").replace(/\s+/g, " ").slice(0, 220)}"`,
      ].filter(Boolean);
      return bits.join(" | ");
    }).join("\n");

    const r = await createMessage(anthropic, {
      model: MODEL, max_tokens: 4000, system: sys,
      messages: [{ role: "user", content: "Bronnen:\n" + list }],
    });

    let txt = (r.content && r.content[0] && r.content[0].text) || "{}";
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    if (a >= 0 && b >= 0) txt = txt.slice(a, b + 1);
    let raw = {};
    try { raw = JSON.parse(txt); } catch (_) { raw = {}; }

    return res.status(200).json({ suggestions: sanitize(raw, sources, cats) });
  } catch (e) {
    console.error("triage", e && e.message);
    return res.status(200).json({ suggestions: {}, error: "ai" });
  }
}
