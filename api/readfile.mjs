// Leest een gekoppeld Dropbox-bestand en laat Claude er een samenvatting + taken + afspraken uithalen.
// PDF's: eerst de TEKST eruit (snel, geen zware beeld-verwerking) — dat voorkomt de 'Premature close'
// die bij het als-beeld-versturen optrad. Beeld/opmaak (bv. tabellen) alleen op verzoek via mode:"vision".
import Anthropic from "@anthropic-ai/sdk";
import { svc, logUsage } from "../lib/usage.mjs";
import { createMessage } from "../lib/airetry.mjs";
import { getDocumentProxy, extractText } from "unpdf";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";

const TEXT_EXT = ["txt","md","markdown","csv","tsv","json","html","htm","xml","log","rtf"];

function directLink(link) {
  try {
    const u = new URL(link);
    u.searchParams.set("dl", "1");
    return u.toString();
  } catch (_) {
    return link.includes("?") ? link + "&dl=1" : link + "?dl=1";
  }
}

function buildSys(today) {
  return "Je bent de assistent van Begeister (licht/decor/event-productie). "
    + "Antwoord UITSLUITEND met geldige JSON, zonder tekst eromheen, exact in deze vorm:\n"
    + '{"summary":"2-4 zinnen kernpunten in het Nederlands","tasks":["korte concrete actie"],"appointments":[{"title":"waarover","date":"YYYY-MM-DD of lege string","time":"HH:MM of lege string"}]}\n'
    + "tasks = duidelijke to-do's uit het document. appointments = afspraken, deadlines of concrete data met (indien vermeld) datum en tijd. "
    + "Verzin niets; laat een array leeg als er niets duidelijks in staat. Vandaag is " + today + ".";
}

function parseResult(raw) {
  const txt = String(raw || "").trim();
  let obj = null;
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s >= 0 && e > s) { try { obj = JSON.parse(txt.slice(s, e + 1)); } catch (_) {} }
  if (!obj || typeof obj !== "object") return { summary: txt, tasks: [], appointments: [] };
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    summary: String(obj.summary || "").trim(),
    tasks: arr(obj.tasks).map(t => String(t || "").trim()).filter(Boolean).slice(0, 12),
    appointments: arr(obj.appointments).map(a => ({
      title: String((a && a.title) || "").trim(),
      date: String((a && a.date) || "").trim(),
      time: String((a && a.time) || "").trim(),
    })).filter(a => a.title).slice(0, 12),
  };
}

// Zet technische fouten om in een begrijpelijke melding voor de gebruiker.
function friendlyErr(e) {
  const m = String((e && e.message) || e || "").toLowerCase();
  const status = e && (e.status || e.statusCode);
  if (status === 401 || /authentication|invalid x-api-key|\bapi key\b/.test(m)) return "AI-sleutel lijkt ongeldig — controleer de ANTHROPIC_API_KEY.";
  if (status === 402 || status === 403 || /credit balance is too low|insufficient|quota|billing|payment required/.test(m)) return "AI-tegoed is op — vul het aan in de Anthropic Console (Billing).";
  if (status === 429 || /rate limit|overloaded/.test(m)) return "AI is even te druk — probeer het zo opnieuw.";
  if (/premature close|fetch failed|econnreset|terminated|socket hang up|network|und_err|timeout/.test(m)) return "De verbinding met de AI viel weg (mogelijk is het tegoed op of een tijdelijke storing). Probeer het opnieuw.";
  return String((e && e.message) || e || "onbekende fout");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!anthropic) return res.status(200).json({ error: "AI niet beschikbaar" });
  try {
    const { link = "", name = "bestand", mode = "text" } = req.body || {};
    if (!link) return res.status(200).json({ error: "geen link" });
    const ext = (name.split(".").pop() || "").toLowerCase();
    const durl = directLink(link);
    const today = new Date().toISOString().slice(0, 10);
    const SYS = buildSys(today);

    // Niet-streamend: streaming (SSE) bleek op deze host na ~1,5s af te breken ('Premature close').
    // Omdat we nu alleen TEKST sturen is de call snel genoeg voor een gewone create.
    const run = (content) => createMessage(anthropic, {
      model: MODEL, max_tokens: 900, system: SYS,
      messages: [{ role: "user", content }],
    });

    let content, thin = false;
    const canVision = ext === "pdf";

    if (ext === "pdf" && mode === "vision") {
      // Stap 2 (op verzoek): PDF als beeld+tekst meesturen zodat tabellen/tekst-in-afbeeldingen ook meegaan.
      const r = await fetch(durl, { redirect: "follow" });
      if (!r.ok) return res.status(200).json({ error: "kon bestand niet ophalen (" + r.status + ")" });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 24 * 1024 * 1024) return res.status(200).json({ error: "PDF te groot om als beeld te lezen" });
      content = [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } },
        { type: "text", text: "Lees nu OOK de afbeeldingen en opmaak (bv. tabellen) van dit document (" + name + ") en geef het resultaat volgens de instructie." },
      ];
    } else if (ext === "pdf") {
      // Stap 1: alleen de PDF-tekst (snel).
      const r = await fetch(durl, { redirect: "follow" });
      if (!r.ok) return res.status(200).json({ error: "kon bestand niet ophalen (" + r.status + ")" });
      const u8 = new Uint8Array(await r.arrayBuffer());
      let text = "";
      try {
        const pdf = await getDocumentProxy(u8);
        const ex = await extractText(pdf, { mergePages: true });
        text = (ex && ex.text ? ex.text : "").replace(/[ \t]+\n/g, "\n").trim();
      } catch (_) {}
      thin = text.replace(/\s/g, "").length < 120;
      if (text.length > 120000) text = text.slice(0, 120000);
      content = [{ type: "text", text: "BESTAND (PDF-tekst): " + name + "\n\n\"\"\"\n" + (text || "(geen leesbare tekst gevonden)") + "\n\"\"\"\n\nGeef het resultaat volgens de instructie." }];
    } else if (TEXT_EXT.includes(ext)) {
      const r = await fetch(durl, { redirect: "follow" });
      if (!r.ok) return res.status(200).json({ error: "kon bestand niet ophalen (" + r.status + ")" });
      let txt = await r.text();
      if (txt.length > 120000) txt = txt.slice(0, 120000);
      content = [{ type: "text", text: "BESTAND: " + name + "\n\n\"\"\"\n" + txt + "\n\"\"\"\n\nGeef het resultaat volgens de instructie." }];
    } else {
      return res.status(200).json({ error: "dit bestandstype (." + ext + ") kan ik nog niet lezen — pdf en tekstbestanden wel" });
    }

    const resp = await run(content);
    const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const out = parseResult(raw);

    try {
      await logUsage(svc(), { source: "readfile", model: MODEL,
        inputTokens: resp?.usage?.input_tokens || 0, outputTokens: resp?.usage?.output_tokens || 0, webSearches: 0 });
    } catch (_) {}

    return res.status(200).json({ ...out, thin, canVision, mode });
  } catch (e) {
    return res.status(200).json({ error: friendlyErr(e) });
  }
}
