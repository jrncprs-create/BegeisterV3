// Drop-intake: een bestand dat in de app wordt gesleept (foto, PDF, tekst of Word)
// omzetten naar een VOORSTEL met actiepunten ({reply, items}). Slaat zelf niets op —
// de frontend toont het voorstel (bewerkbaar) en de gebruiker keurt goed, net als bij
// de foto-knop. Hergebruikt dezelfde extractie-logica als mail/WhatsApp.
import Anthropic from "@anthropic-ai/sdk";
import { extractItems } from "../intake/extract.mjs";
import { logUsage } from "../lib/usage.mjs";
import { createMessage } from "../lib/airetry.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

function visionSystem({ context, today, who, dates, catalog }) {
  const cat = (catalog || []).map(c => `- ${c.project_id} → ${c.client} · ${c.project}`).join("\n") || "(nog geen klanten/projecten)";
  return `Je bent de AI-assistent van Begeister (licht, decor, events). Je krijgt een BESTAND (foto/screenshot van een appje of mail, een PDF, een document of een whiteboard).
Vat in 1 KORTE zin samen wat erin staat, en haal er concrete ACTIEPUNTEN uit als die er zijn. Verzin niets.
owner = "Jeroen" of "Marlon" of leeg. contact = externe persoon of leeg. due = YYYY-MM-DD of null. status = todo. project_id = ALLEEN als klant/project eenduidig in het bestand staat én matcht met de catalogus, anders null (dan vult de gebruiker het zelf).
${context ? "VASTE CONTEXT (team/bedrijf — gebruik dit):\n" + context + "\n" : ""}VANDAAG: ${today || ""}. GEBRUIKER: ${who || ""}. Reken geen weekdagen zelf uit; gebruik de datumtabel.
DATUMTABEL:\n${dates || "(geen)"}
CATALOGUS (project_id → klant · project):\n${cat}
Bepaal ook of het bestand over een specifieke KLANT/opdrachtgever gaat. Geef "client" = de klantnaam als die duidelijk is, anders "". Geef "project" = de projectnaam als die expliciet genoemd wordt; staat er geen projectnaam maar wél een duidelijk onderwerp, stel dan een KORTE projectnaam voor (paar woorden); anders "".
Geef "type" = kort documenttype in 1-2 woorden (bv. "pitchdeck", "offerte", "factuur", "mail", "screenshot", "tekening", "draaiboek"), anders "". Geef "from" = afzender/auteur als die herkenbaar is, anders "".
Geef "category" = kies de best passende map uit deze VASTE lijst: Briefing, Concept & ontwerp, Techniek, Beeld, Financieel, Oplevering. Bij twijfel: "Concept & ontwerp". Richtlijn: Briefing = aanvraag/projectbrief/intake/debrief; Concept & ontwerp = concept/moodboard/lichtontwerp/decor/ontwerp; Techniek = tekeningen/plattegronden/draaiboek/planning/leveranciers/patch/rigging; Beeld = foto's/video/referenties/inspiratie; Financieel = offerte/factuur/bon/inkoop/budget/calculatie/prijsopgave; Oplevering = eindfoto's/nazorg/aftermovie/eindresultaat.
Geef "subject" = kort, concreet onderwerp van het document in 2-3 woorden (zo bondig mogelijk), ZONDER klantnaam en ZONDER datum, MÉT het documenttype erin verwerkt als dat logisch is (bv. "licht offerte", "concept", "draaiboek opbouw", "factuur huur"). Geen interne codenamen of projectcodes. Kleine letters, gewone spaties, geen leestekens.
Geef "kind" = "werk", "inspiratie" of "prive". "inspiratie" = beeld, sfeer, referentie of een mooie foto zónder concrete actie. "prive" = persoonlijk, niets met werk te maken. Bij "inspiratie" laat je "items" ALTIJD leeg — een referentiebeeld levert geen actiepunten op. Bij twijfel: "werk".
Antwoord ALLEEN met geldige JSON: {"reply":"korte samenvatting (1 zin)","client":"","project":"","type":"","from":"","category":"","subject":"","kind":"werk","items":[{"title":"","owner":"","contact":"","due":null,"status":"todo","project_id":null}]}`;
}

async function aiFromBlocks(blocks, opts, src) {
  if (!anthropic) return { reply: "(AI staat uit) Bestand ontvangen.", items: [] };
  const resp = await createMessage(anthropic, {
    model: MODEL, max_tokens: 1500, system: visionSystem(opts),
    messages: [{ role: "user", content: blocks }],
  });
  try {
    await logUsage(null, {
      source: src, model: MODEL,
      inputTokens: resp?.usage?.input_tokens || 0,
      outputTokens: resp?.usage?.output_tokens || 0,
      webSearches: 0,
    });
  } catch (_) {}
  const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
  const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed;
  try { parsed = JSON.parse(slice); }
  catch (_) { parsed = { reply: raw.trim() || "Ik heb het bestand bekeken.", items: [] }; }
  const kind = ["werk", "inspiratie", "prive"].includes(parsed.kind) ? parsed.kind : "werk";
  // Inspiratie levert nooit actiepunten op — hard afdwingen, niet alleen vragen.
  const items = (kind === "inspiratie") ? [] : (Array.isArray(parsed.items) ? parsed.items : []);
  return { reply: parsed.reply || "", items, kind, client: (parsed.client || "").toString().trim(), project: (parsed.project || "").toString().trim(), type: (parsed.type || "").toString().trim(), from: (parsed.from || "").toString().trim(), category: (parsed.category || "").toString().trim(), subject: (parsed.subject || "").toString().trim() };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { name = "", mime = "", b64 = "", text = "", catalog = [], today = "", dates = "", who = "", context = "" } = req.body || {};
    const opts = { context, today, who, dates, catalog };
    const data = String(b64 || "").replace(/^data:[^;]+;base64,/, "");
    const m = (mime || "").toLowerCase();

    // 1) Afbeelding → image-block
    if (m.startsWith("image/")) {
      if (!data) return res.status(400).json({ error: "geen afbeeldingsdata" });
      const blocks = [
        { type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data } },
        { type: "text", text: `Toegevoegde afbeelding${name ? " (" + name + ")" : ""}. Vat samen en stel actiepunten voor.` },
      ];
      return res.status(200).json(await aiFromBlocks(blocks, opts, "drop-image"));
    }

    // 2) PDF → document-block (Claude leest de PDF zelf)
    if (m === "application/pdf" || /\.pdf$/i.test(name)) {
      if (!data) return res.status(400).json({ error: "geen PDF-data" });
      const blocks = [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
        { type: "text", text: `Toegevoegde PDF${name ? " (" + name + ")" : ""}. Vat samen en stel actiepunten voor.` },
      ];
      return res.status(200).json(await aiFromBlocks(blocks, opts, "drop-pdf"));
    }

    // 3) Word (.docx) → tekst eruit halen met mammoth, dan extractItems
    if (m.includes("officedocument.wordprocessingml") || /\.docx$/i.test(name)) {
      if (!data) return res.status(400).json({ error: "geen document-data" });
      let docText = "";
      try {
        const mammoth = (await import("mammoth")).default || (await import("mammoth"));
        const out = await mammoth.extractRawText({ buffer: Buffer.from(data, "base64") });
        docText = (out && out.value) ? out.value.trim() : "";
      } catch (e) {
        return res.status(200).json({ reply: "Ik kon dit Word-document niet automatisch lezen — plak de tekst of vertel kort wat erin staat?", items: [] });
      }
      if (!docText) return res.status(200).json({ reply: "Het Word-document lijkt leeg of bevat geen leesbare tekst.", items: [] });
      const ex = await extractItems({ text: docText, sender: who || "Document", subject: name, today, catalog, context });
      if (ex.usage) { try { await logUsage(null, { source: "drop-docx", ...ex.usage }); } catch (_) {} }
      return res.status(200).json({ reply: ex.summary || "Document gelezen.", items: ex.items || [], client: ex.client || "", project: ex.project || "", type: ex.type || "", from: ex.from || "", category: ex.category || "", subject: ex.subject || "" });
    }

    // 4) Platte tekst (.txt/.md/etc.) → extractItems
    const plain = (text || "").trim() || (data ? Buffer.from(data, "base64").toString("utf8").trim() : "");
    if (plain) {
      const ex = await extractItems({ text: plain, sender: who || "Tekst", subject: name, today, catalog, context });
      if (ex.usage) { try { await logUsage(null, { source: "drop-text", ...ex.usage }); } catch (_) {} }
      return res.status(200).json({ reply: ex.summary || "Tekst gelezen.", items: ex.items || [], client: ex.client || "", project: ex.project || "", type: ex.type || "", from: ex.from || "", category: ex.category || "", subject: ex.subject || "" });
    }

    return res.status(400).json({ error: "leeg of niet-ondersteund bestandstype: " + (mime || name) });
  } catch (e) {
    console.error("readdrop:", e.message);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
