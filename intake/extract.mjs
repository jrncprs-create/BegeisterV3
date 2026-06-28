// Haalt met Claude gestructureerde actiepunten uit een binnengekomen bericht.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

const SYSTEM = `Je bent de intake-assistent van Begeister (licht, decor en event-productie).
Je krijgt een ruw binnengekomen bericht (mail of doorgestuurd appje) en een catalogus
van bekende klanten/projecten. Je taak: haal er concrete, losse ACTIEPUNTEN uit.

Regels:
- Eén actiepunt = één concrete taak of afspraak. Splits samengestelde zinnen.
- Verzin niets. Alleen wat echt in het bericht staat.
- owner = wie binnen Begeister het oppakt: "Jeroen" of "Marlon". Weet je het niet, laat leeg.
- contact = de externe persoon waar het mee te maken heeft (bv. Leon, Willem, Noa). Mag leeg.
- due = ISO-datum (YYYY-MM-DD) alleen als er een concrete datum/deadline genoemd is, anders null.
- status = todo | doing | wait | done. "wait" als er op iemand gewacht wordt.
- project_id = ALLEEN invullen als de klant of het project expliciet en eenduidig in het bericht genoemd wordt en exact matcht met de catalogus. Bij enige twijfel: null (de gebruiker koppelt het dan zelf).
- contacts = externe personen die EXPLICIET in het bericht voorkomen, met hun gegevens. Wees conservatief: alleen contacten die echt in het bericht staan. Verzin geen e-mailadressen of telefoonnummers. Lege velden laat je leeg (""). Neem GEEN interne Begeister-mensen (Jeroen, Marlon) op.
- client = de klant/opdrachtgever waar dit bericht duidelijk over gaat (anders ""). project = projectnaam als die expliciet genoemd wordt; staat er geen projectnaam maar wél een duidelijk onderwerp, stel dan een KORTE projectnaam voor (paar woorden); anders "".
- type = kort documenttype in 1-2 woorden (bv. "mail", "appje", "offerte", "factuur", "pitchdeck", "draaiboek"), anders "". from = afzender/auteur als die herkenbaar is, anders "".
- subject = kort, concreet onderwerp in 2-3 woorden (zo bondig mogelijk), ZONDER klantnaam en ZONDER datum, MÉT het documenttype erin verwerkt als dat logisch is (bv. "licht offerte", "concept", "draaiboek opbouw"). Geen interne codenamen of projectcodes. Kleine letters, gewone spaties, geen leestekens.
- category = best passende map uit deze VASTE lijst: Concept, Lichtontwerp, Decor, Tekeningen, Plattegronden, Draaiboek, Planning, Leveranciers, Techniek, Offertes, Media. Bij twijfel: "Concept".
- Geef ALLEEN geldige JSON terug, geen uitleg eromheen.`;

/**
 * @param {{text:string, sender?:string, subject?:string, today:string,
 *          catalog:Array<{project_id:string, client:string, project:string}>}} input
 * @returns {Promise<{items:Array, summary:string, contacts:Array}>}
 */
export async function extractItems({ text, sender = "", subject = "", today, catalog, context = "" }) {
  // Geen AI-key? Val terug op één concept-actiepunt zodat intake blijft werken.
  if (!anthropic) {
    const firstLine = (subject || (text || "").split("\n").find(l => l.trim()) || "Nieuw bericht").trim().slice(0, 120);
    return { items: [{ title: firstLine, owner: "", contact: "", due: null, status: "todo", project_id: null }], summary: firstLine, contacts: [], usage: null };
  }
  const user = `VANDAAG: ${today}
AFZENDER: ${sender}
ONDERWERP: ${subject}

BERICHT:
"""
${text}
"""

CATALOGUS (kies project_id):
${catalog.map(c => `- ${c.project_id} → ${c.client} · ${c.project}`).join("\n") || "(leeg)"}

Geef JSON in exact dit formaat:
{
  "summary": "korte samenvatting van het bericht in 1 zin",
  "client": "",
  "project": "",
  "type": "",
  "from": "",
  "category": "",
  "subject": "",
  "items": [
    { "title": "...", "owner": "Jeroen|Marlon|", "contact": "", "due": null, "status": "todo", "project_id": null }
  ],
  "contacts": [
    { "name": "...", "email": "", "phone": "", "company": "", "role": "" }
  ]
}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1800,
    system: SYSTEM + (context ? "\n\nVASTE CONTEXT (team/bedrijf — gebruik dit om beter te koppelen):\n" + context : ""),
    messages: [{ role: "user", content: user }],
  });

  const usage = {
    model: MODEL,
    inputTokens: resp?.usage?.input_tokens || 0,
    outputTokens: resp?.usage?.output_tokens || 0,
    webSearches: 0,
  };
  const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(json);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      summary: parsed.summary || "",
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      client: (parsed.client || "").toString().trim(),
      project: (parsed.project || "").toString().trim(),
      type: (parsed.type || "").toString().trim(),
      from: (parsed.from || "").toString().trim(),
      category: (parsed.category || "").toString().trim(),
      subject: (parsed.subject || "").toString().trim(),
      usage,
    };
  } catch (e) {
    console.error("Kon Claude-antwoord niet als JSON lezen:", raw);
    return { items: [], summary: "", contacts: [], usage };
  }
}
