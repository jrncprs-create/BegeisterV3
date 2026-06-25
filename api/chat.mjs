// AI-chat endpoint. Praat met Claude, vraagt door bij open eindjes,
// en geeft pas actiepunten terug als het duidelijk genoeg is.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

const SYSTEM = `Je bent de AI-assistent van Begeister (licht, decor en event-productie).
Je praat kort, warm en concreet in het Nederlands met Jeroen of Marlon.

Doel: van losse input (een appje, mail, aantekening of voice-transcriptie) heldere ACTIEPUNTEN maken
en open eindjes ophelderen.

Werkwijze:
- Begrijp de input en splits samengestelde berichten in losse, concrete taken.
- Is het onduidelijk bij welke KLANT of welk PROJECT iets hoort, wie het oppakt (owner) of wanneer het af moet,
  stel dan ÉÉN gerichte vervolgvraag. Verzin niets.
- Zodra het duidelijk genoeg is, geef je de actiepunten terug en bevestig je kort wat je hebt genoteerd.
- owner = "Jeroen" of "Marlon" (of leeg). contact = de externe persoon (of leeg).
  due = ISO-datum YYYY-MM-DD als er een concrete deadline is, anders null.
  status = todo | doing | wait | done ("wait" als er op iemand gewacht wordt).
- project_id = kies de best passende uit de catalogus, of null als je het echt nog niet zeker weet.

Antwoord ALTIJD met geldige JSON en niets eromheen:
{"reply":"je bericht aan de gebruiker","items":[{"title":"","owner":"","contact":"","due":null,"status":"todo","project_id":null}]}

Laat "items" leeg ([]) zolang je nog een vraag stelt. Vul "items" pas als je zeker genoeg bent.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { history = [], catalog = [], today, who } = req.body || {};
    if (!anthropic) {
      return res.status(200).json({ reply: "(AI staat nog uit — ik heb je input genoteerd.)", items: [], noai: true });
    }
    const cat = (catalog || []).map(c => `- ${c.project_id} → ${c.client} · ${c.project}`).join("\n") || "(nog geen klanten/projecten)";
    const sys = `${SYSTEM}\n\nVANDAAG: ${today || ""}\nGEBRUIKER: ${who || ""}\nCATALOGUS (project_id → klant · project):\n${cat}`;
    const messages = (history || []).slice(-24).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })).filter(m => m.content);
    if (!messages.length) return res.status(200).json({ reply: "Waar kan ik mee helpen?", items: [] });

    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 1400, system: sys, messages,
    });
    const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed;
    try { parsed = JSON.parse(slice); }
    catch (_) { parsed = { reply: raw.trim() || "Sorry, dat snapte ik niet helemaal.", items: [] }; }
    return res.status(200).json({
      reply: parsed.reply || "",
      items: Array.isArray(parsed.items) ? parsed.items : [],
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
