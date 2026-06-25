// Haalt met Claude gestructureerde actiepunten uit een binnengekomen bericht.
import Anthropic from "@anthropic-ai/sdk";

const KEY = process.env.ANTHROPIC_API_KEY;
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
- project_id = kies de best passende uit de catalogus. Geen match? null.
- Geef ALLEEN geldige JSON terug, geen uitleg eromheen.`;

/**
 * @param {{text:string, sender?:string, subject?:string, today:string,
 *          catalog:Array<{project_id:string, client:string, project:string}>}} input
 * @returns {Promise<{items:Array, summary:string}>}
 */
export async function extractItems({ text, sender = "", subject = "", today, catalog }) {
  // Geen AI-key? Val terug op één concept-actiepunt zodat intake blijft werken.
  if (!anthropic) {
    const firstLine = (subject || (text || "").split("\n").find(l => l.trim()) || "Nieuw bericht").trim().slice(0, 120);
    return { items: [{ title: firstLine, owner: "", contact: "", due: null, status: "todo", project_id: (catalog[0] ? catalog[0].project_id : null) }], summary: "" };
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
  "items": [
    { "title": "...", "owner": "Jeroen|Marlon|", "contact": "", "due": null, "status": "todo", "project_id": null }
  ]
}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1800,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(json);
    return { items: Array.isArray(parsed.items) ? parsed.items : [], summary: parsed.summary || "" };
  } catch (e) {
    console.error("Kon Claude-antwoord niet als JSON lezen:", raw);
    return { items: [], summary: "" };
  }
}
