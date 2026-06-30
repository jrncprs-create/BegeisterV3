// Zet een geplakte winkelwagen/lijst (bv. Amazon) om in gestructureerde inkoopregels.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const text = (req.body && req.body.text || "").toString().slice(0, 20000).trim();
  if (!text) return res.status(400).json({ error: "geen tekst" });
  if (!anthropic) return res.status(200).json({ items: [] });
  const sys = `Je zet een geplakte winkelwagen of bestellijst (bijvoorbeeld van Amazon) om in gestructureerde inkoopregels voor een eventbedrijf (licht, decor, events).
Haal per product: name (korte, duidelijke productnaam), qty (aantal, standaard 1), price (STUKSPRIJS in euro's als getal zonder valutateken, of null als onbekend), url (productlink als die letterlijk in de tekst staat, anders null).
Verzin NOOIT prijzen of links. Negeer verzendkosten, subtotalen, totalen, kortingen, reclame- en navigatietekst. Behandel duidelijke regels als losse producten.
Antwoord ALLEEN met geldige JSON: {"items":[{"name":"","qty":1,"price":null,"url":null}]}`;
  try {
    const r = await anthropic.messages.create({ model: MODEL, max_tokens: 1600, system: sys, messages: [{ role: "user", content: text }] });
    const raw = r.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed; try { parsed = JSON.parse(slice); } catch (_) { parsed = { items: [] }; }
    const items = (Array.isArray(parsed.items) ? parsed.items : []).map(it => ({
      name: String(it.name || "").slice(0, 200).trim(),
      qty: Math.max(1, parseInt(it.qty, 10) || 1),
      price: (it.price == null || isNaN(Number(it.price))) ? null : Number(it.price),
      url: (it.url && /^https?:\/\//i.test(it.url)) ? String(it.url) : null,
    })).filter(it => it.name);
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(200).json({ items: [], error: String(e.message || e) });
  }
}
