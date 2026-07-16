// Haalt met Claude gestructureerde actiepunten uit een binnengekomen bericht.
import Anthropic from "@anthropic-ai/sdk";
import { createMessage } from "../lib/airetry.mjs";
import { BEGEISTER_REGELS } from "../lib/ai-regels.mjs";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

// --- Links in een bericht ophalen en als leesbare tekst meegeven aan Claude ---
const URL_RE = /https?:\/\/[^\s<>()"']+/gi;
async function fetchPageText(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
    } });
    clearTimeout(t);
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return "";
    let html = (await r.text()).slice(0, 500000);
    html = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleM ? titleM[1].replace(/\s+/g, " ").trim() : "";
    // Product-links behouden: <a href="…">tekst</a> → "tekst <absolute-url>" zodat Claude per item de link kan koppelen.
    let base; try { base = new URL(url); } catch (_) { base = null; }
    const abs = (href) => { try { return base ? new URL(href, base).href : href; } catch (_) { return href; } };
    html = html.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
      const tx = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const u = abs(href.replace(/&amp;/gi, "&"));
      if (!/^https?:/i.test(u)) return " " + tx + " ";
      return " " + (tx ? tx + " " : "") + "<" + u + "> ";
    });
    let text = html.replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim().slice(0, 9000);
    return (title ? "TITEL: " + title + "\n" : "") + text;
  } catch (_) { return ""; }
}
async function fetchLinkContext(text) {
  const urls = [...new Set((String(text).match(URL_RE) || []).map(u => u.replace(/[.,;)]+$/, "")))].slice(0, 2);
  if (!urls.length) return "";
  const parts = [];
  for (const u of urls) { const t = await fetchPageText(u); if (t) parts.push("URL: " + u + "\n" + t); }
  return parts.length ? "\n\nINHOUD VAN GELINKTE PAGINA('S) (automatisch opgehaald — gebruik dit om samen te vatten, de klant/het project te bepalen en actiepunten te halen):\n" + parts.join("\n\n---\n\n") : "";
}

const SYSTEM = `Je bent de intake-assistent van Begeister (licht, decor en event-productie).
Je krijgt een ruw binnengekomen bericht (mail of doorgestuurd appje) en een catalogus
van bekende klanten/projecten. Je taak: haal er concrete, losse ACTIEPUNTEN uit.

Regels:
- Eén actiepunt = één concrete taak of afspraak. Splits samengestelde zinnen.
- Verzin niets. Alleen wat echt in het bericht staat.
- WEES STRENG met taken (L8a, 16 juli 2026): een taak is er alleen als er echt iets te DOEN staat
  (een werkwoord met een handeling: regelen, sturen, bevestigen, maken, bellen…). Maten,
  specificaties, aantallen, materiaallijsten, technische gegevens = FEITEN, geen taken.
  Verzin NOOIT een controle- of check-taak bij een specificatie ("controleer of de maten
  kloppen" is verboden tenzij het bericht daar letterlijk om vraagt). Een algemene
  omschrijving van wat Begeister gaat doen ("wij doen het licht en de opbouw") is SCOPE,
  geen taak. Liever 0 taken dan een verzonnen taak.
- facts = korte, zelfstandig leesbare FEITZINNEN die het waard zijn om te onthouden bij het
  project: maten ("bogentent: breedte 6,20 m, zijhoogte 2,44 m, nokhoogte 4,50 m"),
  materiaal- of apparatuurlijsten (vat samen: "Willem neemt eigen licht mee: 8x PAR64, 2x
  haze…"), locatiegegevens, tijden van het evenement, technische specificaties, gemaakte
  keuzes ("klant kiest voor warme kleurtemperatuur"). Elk feit kort (max ~140 tekens),
  feitelijk, zonder mening. Geen feiten die al een taak of afspraak zijn. Meestal 0-5 stuks.
- scope = één zin die beschrijft wat Begeister voor dit project doet, ALLEEN als het bericht
  dat expliciet zegt of duidelijk maakt (bv. "wij verzorgen licht en opbouw voor Sloase
  2026"), anders "".
- owner = wie binnen Begeister het oppakt: "Jeroen" of "Marlon". Weet je het niet, laat leeg.
- contact = de externe persoon waar het mee te maken heeft (bv. Leon, Willem, Noa). Mag leeg.
- due = ISO-datum (YYYY-MM-DD) alleen als er een concrete datum/deadline genoemd is, anders null.
- status = todo | doing | wait | done. "wait" als er op iemand gewacht wordt.
- project_id = ALLEEN invullen als de klant of het project expliciet en eenduidig in het bericht genoemd wordt en exact matcht met de catalogus. Bij enige twijfel: null (de gebruiker koppelt het dan zelf).
- contacts = externe personen die EXPLICIET in het bericht voorkomen, met hun gegevens. Wees conservatief: alleen contacten die echt in het bericht staan. Verzin geen e-mailadressen of telefoonnummers. Lege velden laat je leeg (""). Neem GEEN interne Begeister-mensen (Jeroen, Marlon) op.
- client = de klant/opdrachtgever waar dit bericht duidelijk over gaat (anders ""). project = projectnaam als die expliciet genoemd wordt; staat er geen projectnaam maar wél een duidelijk onderwerp, stel dan een KORTE projectnaam voor (paar woorden); anders "".
- type = kort documenttype in 1-2 woorden (bv. "mail", "appje", "offerte", "factuur", "pitchdeck", "draaiboek"), anders "". from = afzender/auteur als die herkenbaar is, anders "".
- subject = kort, concreet onderwerp in 2-3 woorden (zo bondig mogelijk), ZONDER klantnaam en ZONDER datum, MÉT het documenttype erin verwerkt als dat logisch is (bv. "licht offerte", "concept", "draaiboek opbouw"). Geen interne codenamen of projectcodes. Kleine letters, gewone spaties, geen leestekens.
- category = best passende map uit deze VASTE lijst: Briefing, Concept & ontwerp, Techniek, Beeld, Financieel, Oplevering. Bij twijfel: "Concept & ontwerp". Richtlijn: Briefing = aanvraag/projectbrief/intake/debrief; Concept & ontwerp = concept/moodboard/lichtontwerp/decor/ontwerp; Techniek = tekeningen/plattegronden/draaiboek/planning/leveranciers/patch/rigging; Beeld = foto's/video/referenties/inspiratie; Financieel = offerte/factuur/bon/inkoop/budget/calculatie/prijsopgave; Oplevering = eindfoto's/nazorg/aftermovie/eindresultaat.
- appointments = afspraken/meetings die EXPLICIET in het bericht worden voorgesteld of bevestigd, mét een concrete datum. Per afspraak: title (kort, bv. "Meeting Willem — Landjuweel"), date (YYYY-MM-DD, reken relatief t.o.v. VANDAAG), start (HH:MM of null), end (HH:MM of null), location (of ""). GEEN afspraken verzinnen; een deadline is geen afspraak. Geen concrete datum = niet opnemen. Meestal is dit een lege lijst.
- reply = een kort CONCEPT-ANTWOORD op het bericht (alleen bij een e-mail die om een reactie vraagt, anders ""). Nederlands, vriendelijk en professioneel, 3-6 zinnen. Begin met "Beste <voornaam>," of "Hoi <voornaam>," (voornaam uit de afzender; anders "Beste,"). Beantwoord wat er gevraagd wordt; weet je iets niet (prijs, datum, beschikbaarheid), zeg dan dat je erop terugkomt — verzin NIETS. Sluit af met "Groet," en daarna niets (de ondertekenaar vult de app zelf in).
- BESTELLIJST/WINKELWAGEN/VERLANGLIJST: gaat de gelinkte pagina over een winkelwagen, verlanglijst of productlijst van een webshop (Amazon, Bol, Coolblue, enz.), maak dan van ELK product één item. Zet de prijs in de titel tussen haakjes, bv. "H03VV-F snoer zwart 25m (€21,05)". Geef bij zo'n item "url" = de DIRECTE productlink (de <…>-URL die in de opgehaalde pagina direct bij dat product staat). Kun je de productlink niet vinden, dan url = null. Bij gewone actiepunten (geen product) is url altijd null.
- Geef ALLEEN geldige JSON terug, geen uitleg eromheen.
` + BEGEISTER_REGELS;

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
  "reply": "",
  "items": [
    { "title": "...", "owner": "Jeroen|Marlon|", "contact": "", "due": null, "status": "todo", "project_id": null, "url": null }
  ],
  "facts": [ "..." ],
  "scope": "",
  "contacts": [
    { "name": "...", "email": "", "phone": "", "company": "", "role": "" }
  ],
  "appointments": [
    { "title": "...", "date": "YYYY-MM-DD", "start": null, "end": null, "location": "" }
  ]
}`;

  // Links in het bericht ophalen en als context meegeven (pagina samenvatten + koppelen + actiepunten).
  const linkCtx = await fetchLinkContext(text);

  const resp = await createMessage(anthropic, {
    model: MODEL,
    max_tokens: 1800,
    system: SYSTEM + (context ? "\n\nVASTE CONTEXT (team/bedrijf — gebruik dit om beter te koppelen):\n" + context : ""),
    messages: [{ role: "user", content: user + linkCtx }],
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
      reply: (parsed.reply || "").toString().trim(),
      appointments: (Array.isArray(parsed.appointments) ? parsed.appointments : [])
        .filter(a => a && a.title && /^\d{4}-\d{2}-\d{2}$/.test(String(a.date || ""))),
      facts: (Array.isArray(parsed.facts) ? parsed.facts : [])
        .map(f => String(f || "").trim()).filter(Boolean).slice(0, 10),
      scope: (parsed.scope || "").toString().trim(),
      usage,
    };
  } catch (e) {
    console.error("Kon Claude-antwoord niet als JSON lezen:", raw);
    return { items: [], summary: "", contacts: [], facts: [], scope: "", usage };
  }
}
