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
export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Ruimt een voorgestelde klant-/projectnaam op. Geeft "" terug als er niets bruikbaars is.
function schoon(naam) {
  return String(naam || "").replace(/\s+/g, " ").replace(/["`]/g, "").trim().slice(0, 60);
}

export function sanitize(raw, sources, cats) {
  const byId = new Map((sources || []).map(s => [String(s.id), s]));
  const projSet = new Set((cats || []).map(c => String(c.id ?? c.project_id ?? "")));
  // Klantnamen exact zoals ze in de catalogus staan, opzoekbaar op kleine letters.
  const klantOp = new Map();
  (cats || []).forEach(c => { if (c.client) klantOp.set(c.client.toLowerCase(), c.client); });

  const out = {};
  for (const [sid, val] of Object.entries(raw || {})) {
    const bron = byId.get(String(sid));
    if (!bron || !val || typeof val !== "object") continue;

    let kind = KINDS.includes(val.kind) ? val.kind : "werk";
    const reden = String(val.reden || "");

    // Vangnet 1: een bron met een bijlage is nooit ruis. Daar hangt een bestand aan.
    if (kind === "ruis" && bron.bijlage) kind = "werk";

    // Vangnet 2: het model ziet maar één blok en kan dus niet weten of iets dubbel is.
    // Beroept het zich tóch op dubbel-zijn, dan is dat een gok — niet wegzetten.
    // Let op: het model antwoordt in het Nederlands, maar glipt er soms Engels doorheen
    // ("Duplicate spam ..."). Beide talen afvangen, en geen \b vóór een woord dat met
    // een letter begint — dat maakte de eerste variant onbetrouwbaar.
    if (kind === "ruis" && /(dubbel|duplicaat|duplicate|identiek|identical)/i.test(reden)) kind = "werk";

    const pid = projSet.has(String(val.project_id || "")) ? String(val.project_id) : "";

    // Voorstel voor iets nieuws. Streng: alleen bij werk zonder bestaand project, en
    // alleen als er ook echt een naam ligt. Bestaat de klant al, dan gebruiken we de
    // schrijfwijze uit de catalogus — anders krijg je "bonbon vivant" naast "BonBon Vivant".
    let nieuwKlant = "", nieuwProject = "";
    if (kind === "werk" && !pid) {
      nieuwKlant = schoon(val.nieuw_klant);
      nieuwProject = schoon(val.nieuw_project);
      const bestaand = klantOp.get(nieuwKlant.toLowerCase());
      if (bestaand) nieuwKlant = bestaand;
      // Een voorstel zonder projectnaam én zonder klantnaam is geen voorstel.
      if (!nieuwKlant && !nieuwProject) { nieuwKlant = ""; nieuwProject = ""; }
      // Alleen een projectnaam, zonder klant, kunnen we nergens hangen.
      if (!nieuwKlant) nieuwProject = "";
    }

    out[sid] = { kind, project_id: pid, reden: reden.slice(0, 60),
                 nieuw_klant: nieuwKlant, nieuw_project: nieuwProject,
                 klant_bestaat: !!(nieuwKlant && klantOp.has(nieuwKlant.toLowerCase())) };
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
   - "ruis"       = UITSLUITEND: leeg, een mislukte transcriptie, of tekst zonder enige betekenis.

   Over "ruis" — lees dit twee keer:
   • Je ziet maar een DEEL van de bronnen. Je kunt dus NIET weten of iets dubbel is.
     Noem nooit iets "ruis" omdat het dubbel lijkt. Ontdubbelen is niet jouw taak.
   • Staat er geen passende klant in de catalogus? Dan is het nog steeds "werk" —
     met een leeg project_id. "Geen match" is geen ruis.
   • Een bestand of bijlage is nooit ruis, ook niet als de naam nietszeggend is.
   • Twijfel je tussen werk en ruis? Kies "werk". Iets ten onrechte laten staan kost
     een seconde; iets ten onrechte wegzetten kost een document.

2. "project_id" — ALLEEN een id uit de catalogus hieronder, en alleen als het onmiskenbaar klopt.
   Twijfel je? Laat leeg (""). Een verkeerde koppeling is erger dan geen koppeling.
   Voor "prive" kies je een privé-klant uit de catalogus als die bestaat, anders leeg.
   Voor "inspiratie" en "ruis" laat je project_id leeg tenzij het overduidelijk bij één project hoort.

3. "reden" — maximaal 6 woorden, waarom je dit denkt. In het Nederlands.

4. "nieuw_klant" en "nieuw_project" — ALLEEN invullen bij kind "werk" én een leeg project_id,
   en alleen als je met redelijke zekerheid ziet om welke opdrachtgever of welk project het gaat.
   Je maakt niets aan; je doet een voorstel dat de gebruiker bevestigt of weggooit.
   • Bestaat de klant al in de catalogus? Neem de naam dan LETTERLIJK over uit de catalogus
     en vul alleen "nieuw_project" met een korte projectnaam (2-4 woorden).
   • Gaat het over Begeister zelf (eigen pitch, eigen website, eigen huisvesting, eigen
     inkoop)? Dan is "nieuw_klant" = "Begeister" en "nieuw_project" een korte naam.
   • Nieuwe opdrachtgever? Vul beide. Gebruik de naam zoals die in de tekst staat.
   • Weet je het niet? Laat beide leeg (""). Liever leeg dan geraden.
   Projectnamen zijn kort, zonder klantnaam en zonder jaartal.

CATALOGUS (project_id → klant · project):
${catTxt}

Antwoord ALLEEN met geldige JSON, zonder tekst eromheen:
{"<bron-id>":{"kind":"werk","project_id":"","reden":"","nieuw_klant":"","nieuw_project":""}}`;

    // In blokken. Eén call over 60 bronnen liep tegen max_tokens aan: de JSON werd
    // afgekapt, JSON.parse faalde, en er kwam stilletjes niets terug. Kleine blokken
    // passen ruim binnen de limiet en lopen bovendien parallel.
    const blocks = chunk(sources.slice(0, 90), 15);
    const results = await Promise.all(blocks.map(async (blk, n) => {
      const list = blk.map(s => {
        const bits = [
          `id=${s.id}`,
          `kanaal=${s.channel || "?"}`,
          s.sender ? `van="${String(s.sender).slice(0, 60)}"` : "",
          s.subject ? `onderwerp="${String(s.subject).slice(0, 80)}"` : "",
          `tekst="${String(s.body || "").replace(/\s+/g, " ").slice(0, 220)}"`,
        ].filter(Boolean);
        return bits.join(" | ");
      }).join("\n");

      try {
        const r = await createMessage(anthropic, {
          model: MODEL, max_tokens: 2000, system: sys,
          messages: [{ role: "user", content: "Bronnen:\n" + list }],
        });
        const stop = r.stop_reason;
        let txt = (r.content && r.content[0] && r.content[0].text) || "{}";
        const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
        if (a >= 0 && b >= 0) txt = txt.slice(a, b + 1);
        try {
          return sanitize(JSON.parse(txt), blk, cats);
        } catch (_) {
          // Niet stil falen: dit is precies de fout die we hierboven beschrijven.
          console.error(`triage: blok ${n} onleesbaar (stop_reason=${stop}, ${txt.length} tekens)`);
          return {};
        }
      } catch (e) {
        console.error(`triage: blok ${n} mislukt —`, e && e.message);
        return {};
      }
    }));

    const suggestions = Object.assign({}, ...results);
    const gelukt = Object.keys(suggestions).length;
    console.log(`triage: ${gelukt}/${blocks.flat().length} bronnen voorzien van een voorstel`);
    return res.status(200).json({ suggestions });
  } catch (e) {
    console.error("triage", e && e.message);
    return res.status(200).json({ suggestions: {}, error: "ai" });
  }
}
