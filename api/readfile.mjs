// Leest een gekoppeld Dropbox-bestand (via de deel-link) en laat Claude het kort samenvatten.
import Anthropic from "@anthropic-ai/sdk";
import { svc, logUsage } from "../lib/usage.mjs";
import { createMessageStream } from "../lib/airetry.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

const TEXT_EXT = ["txt","md","markdown","csv","tsv","json","html","htm","xml","log","rtf"];

function directLink(link) {
  // Dropbox-deellink → directe download
  try {
    const u = new URL(link);
    u.searchParams.set("dl", "1");
    return u.toString();
  } catch (_) {
    return link.includes("?") ? link + "&dl=1" : link + "?dl=1";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!anthropic) return res.status(200).json({ error: "AI niet beschikbaar" });
  try {
    const { link = "", name = "bestand" } = req.body || {};
    if (!link) return res.status(200).json({ error: "geen link" });
    const ext = (name.split(".").pop() || "").toLowerCase();

    const SYS = "Je bent de assistent van Begeister (licht/decor/event-productie). Vat het document kort en concreet samen in het Nederlands: 2-4 zinnen kernpunten, en als er duidelijke actiepunten/afspraken/data in staan, noem die kort als lijstje. Geen onzin verzinnen.";
    const durl = directLink(link);
    let content;

    if (ext === "pdf") {
      // Anthropic haalt de PDF zélf op via de URL — dan hoeft de server geplaatste megabytes niet te uploaden
      // (dat veroorzaakte de aanhoudende 'Premature close' bij grotere PDF's).
      content = [
        { type: "document", source: { type: "url", url: durl } },
        { type: "text", text: "Vat dit document (" + name + ") samen volgens de instructie." },
      ];
    } else if (TEXT_EXT.includes(ext)) {
      const r = await fetch(durl, { redirect: "follow" });
      if (!r.ok) return res.status(200).json({ error: "kon bestand niet ophalen (" + r.status + ")" });
      let txt = await r.text();
      if (txt.length > 120000) txt = txt.slice(0, 120000);
      content = [{ type: "text", text: "BESTAND: " + name + "\n\n\"\"\"\n" + txt + "\n\"\"\"\n\nVat dit samen volgens de instructie." }];
    } else {
      return res.status(200).json({ error: "dit bestandstype (." + ext + ") kan ik nog niet lezen — pdf en tekstbestanden wel" });
    }

    const summarize = (c) => createMessageStream(anthropic, {
      model: MODEL, max_tokens: 700, system: SYS,
      messages: [{ role: "user", content: c }],
    });

    let resp;
    try {
      resp = await summarize(content);
    } catch (e) {
      // Vangnet: lukt het ophalen-via-URL niet, dan de PDF alsnog zelf downloaden en als base64 meesturen.
      if (ext !== "pdf") throw e;
      const r2 = await fetch(durl, { redirect: "follow" });
      if (!r2.ok) throw e;
      const buf = Buffer.from(await r2.arrayBuffer());
      if (buf.length > 24 * 1024 * 1024) return res.status(200).json({ error: "PDF te groot om te lezen" });
      resp = await summarize([
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } },
        { type: "text", text: "Vat dit document (" + name + ") samen volgens de instructie." },
      ]);
    }
    const summary = resp.content.map(b => (b.type === "text" ? b.text : "")).join("").trim();

    try {
      await logUsage(svc(), { source: "readfile", model: MODEL,
        inputTokens: resp?.usage?.input_tokens || 0, outputTokens: resp?.usage?.output_tokens || 0, webSearches: 0 });
    } catch (_) {}

    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(200).json({ error: String(e.message || e) });
  }
}
