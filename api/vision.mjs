// Vision-endpoint: bekijkt een toegevoegde foto, vat 'm samen en stelt actiepunten voor.
import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "../lib/usage.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { image, media_type = "image/jpeg", filename = "", catalog = [], today, dates = "", who, context = "" } = req.body || {};
    if (!anthropic) return res.status(200).json({ reply: "(AI staat uit) Foto bewaard onder Bronnen.", items: [] });
    if (!image) return res.status(400).json({ error: "no image" });
    const cat = (catalog || []).map(c => `- ${c.project_id} → ${c.client} · ${c.project}`).join("\n") || "(nog geen klanten/projecten)";
    const sys = `Je bent de AI-assistent van Begeister (licht, decor, events). Je krijgt een FOTO (bv. een schermafbeelding van een appje/mail, een whiteboard, een document of een situatie ter plaatse).
Vat in 1-2 zinnen samen wat erop staat, en haal er concrete ACTIEPUNTEN uit als die er zijn. Verzin niets.
owner = "Jeroen" of "Marlon" of leeg. contact = externe persoon of leeg. due = YYYY-MM-DD of null. status = todo. project_id = best passend uit de catalogus of null.
${context ? "VASTE CONTEXT (team/bedrijf — gebruik dit):\n" + context + "\n" : ""}VANDAAG: ${today || ""}. GEBRUIKER: ${who || ""}. Reken geen weekdagen zelf uit; gebruik de datumtabel.
DATUMTABEL:\n${dates || "(geen)"}
CATALOGUS (project_id → klant · project):\n${cat}
Antwoord ALLEEN met geldige JSON: {"reply":"korte samenvatting voor de gebruiker","items":[{"title":"","owner":"","contact":"","due":null,"status":"todo","project_id":null}]}`;
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 1400, system: sys,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type, data: image } },
          { type: "text", text: `Dit is een toegevoegde afbeelding${filename ? " (" + filename + ")" : ""}. Vat samen en stel actiepunten voor.` },
        ],
      }],
    });
    await logUsage(null, {
      source: "vision", model: MODEL,
      inputTokens: resp?.usage?.input_tokens || 0,
      outputTokens: resp?.usage?.output_tokens || 0,
      webSearches: 0,
    });
    const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed;
    try { parsed = JSON.parse(slice); }
    catch (_) { parsed = { reply: raw.trim() || "Ik heb de foto bekeken.", items: [] }; }
    return res.status(200).json({ reply: parsed.reply || "", items: Array.isArray(parsed.items) ? parsed.items : [] });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
