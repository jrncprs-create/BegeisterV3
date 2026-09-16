// Stelt een korte, praktische start-checklist voor een project voor (project-werkblad).
import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "../lib/usage.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { client = "", project = "", context = "", existing = [] } = req.body || {};
    if (!anthropic) return res.status(200).json({ todos: [] });
    const sys = `Je bent de assistent van Begeister (licht, decor en event-productie). Stel een korte, PRAKTISCHE start-checklist voor (5 tot 9 punten) om dit project goed op te pakken. Regels:
- Concrete, afvinkbare todo's. Werkwoord vooraan, kort (max ~8 woorden).
- Toegespitst op licht/decor/events waar dat past, maar volg het projecttype.
- Geen datums, geen namen, geen nummering.
- Verzin geen feiten; baseer je op het projecttype en de context.
- Herhaal niets dat al in de bestaande taken staat.
Antwoord ALLEEN met geldige JSON: {"todos":["...","..."]}`;
    const user = `KLANT: ${client}\nPROJECT: ${project}\n${context ? "CONTEXT (team/bedrijf):\n" + context + "\n" : ""}${(existing && existing.length) ? "AL BESTAANDE TAKEN (niet herhalen):\n- " + existing.join("\n- ") + "\n" : ""}`;
    const resp = await anthropic.messages.create({ model: MODEL, max_tokens: 700, system: sys, messages: [{ role: "user", content: user }] });
    try { await logUsage(null, { source: "projtodos", model: MODEL, inputTokens: resp.usage?.input_tokens || 0, outputTokens: resp.usage?.output_tokens || 0, webSearches: 0 }); } catch (_) {}
    const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
    let todos = [];
    try { const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); todos = Array.isArray(p.todos) ? p.todos : []; } catch (_) {}
    return res.status(200).json({ todos: todos.slice(0, 12).map(t => String(t).trim()).filter(Boolean) });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
