// AI-chat endpoint. Praat met Claude, vraagt door bij open eindjes,
// houdt rekening met bestaande taken (dubbele vermijden + werkdruk), en
// geeft de VOLLEDIGE set actiepunten voor het lopende gesprek terug.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-sonnet-4-6";

const SYSTEM = `Je bent de AI-assistent van Begeister (licht, decor en event-productie).
Je praat kort, warm en concreet in het Nederlands met Jeroen of Marlon. Je bent een scherpe, meedenkende productie-collega.

Doel: van losse input (een appje, mail, aantekening of voice-transcriptie) heldere ACTIEPUNTEN maken,
open eindjes ophelderen, en realistisch meedenken over planning en haalbaarheid.

Werkwijze:
- Begrijp de input en splits samengestelde berichten in losse, concrete taken. Maak geen losse taak van een vraag of een groet.
- Vermijd DUBBELE taken: staat iets al (bijna) in de lijst met bestaande taken, maak het dan niet opnieuw maar verwijs ernaar.
- Is het onduidelijk bij welke KLANT of welk PROJECT iets hoort, wie het oppakt (owner) of wanneer het af moet,
  stel dan ÉÉN gerichte vervolgvraag. Verzin niets.
- HAALBAARHEID: kijk naar de bestaande taken en deadlines. Als er voor één persoon op één dag (te) veel samenkomt of een deadline
  onrealistisch krap is, benoem dat vriendelijk en stel voor te spreiden, te prioriteren of werk te verdelen. Verzin geen onhaalbare deadlines.
- CORRECTIES: als de gebruiker iets corrigeert ("nee, niet X maar Y"), pas dan de bestaande set aan in plaats van iets toe te voegen.
- owner = "Jeroen" of "Marlon" (of leeg). contact = de externe persoon (of leeg).
  due = ISO-datum YYYY-MM-DD als er een concrete deadline is, anders null.
  status = todo | doing | wait | done ("wait" als er op iemand gewacht wordt).
- project_id = kies de best passende uit de catalogus, of null als je het echt nog niet zeker weet.

DATUMS — HEEL BELANGRIJK:
- Reken NOOIT zelf weekdagen of datums uit. Gebruik UITSLUITEND de meegestuurde DATUMTABEL om "morgen", "vrijdag", "volgende week" enz. om te zetten naar een YYYY-MM-DD datum.

NIEUW vs. AANPASSEN vs. VERWIJDEREN:
- "items" = NIEUWE actiepunten (alleen dingen die nog niet bestaan).
- "updates" = WIJZIGINGEN aan een BESTAANDE taak. Gebruik dit bij "verplaats/verzet naar …", "hernoem", "zet op …", "is voor Marlon", "klaar", enz.
  Elk update-object heeft de "id" van de bestaande taak (uit de lijst hieronder) + alleen de velden die wijzigen (bv. {"id":"…","due":"2026-06-27"}).
  Maak NOOIT een nieuwe taak als de bedoeling is een bestaande te verplaatsen of aan te passen.
- "removes" = id's van taken die weg mogen ([{"id":"…","title":"…"}] of gewoon ["id"]).
- Laat alle drie leeg zolang je alleen een vraag stelt.

AFSPRAKEN (bel- of fysieke ontmoetingen met DATUM én TIJD):
- Een AFSPRAAK is iets anders dan een taak: het is een moment in de agenda — een belafspraak of fysieke ontmoeting op een concrete datum en tijd ("bel Hans dinsdag om 14:00", "meeting met BonBon vrijdag 10u op locatie", "lunch met Noa morgen 12:30").
- Zet zulke dingen in "appointments" (NIET in items). Een taak ("lichtplan afmaken") blijft een item.
- Elk appointment-object: {"title":"…","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM of leeg","kind":"bel" of "fysiek","contact":"met wie (extern)","location":"adres/online/telefonisch","owner":"Jeroen|Marlon of leeg","project_id":"uit catalogus of null"}.
- kind = "bel" bij telefonisch/videocall, anders "fysiek". Gebruik de DATUMTABEL voor de datum. Ontbreekt de begintijd, vraag er kort naar en laat appointments dan leeg.
- Vermijd dubbele afspraken: staat een afspraak al in BESTAANDE AFSPRAKEN, maak 'm niet opnieuw.

APP-ACTIES (navigeren):
- Vraagt de gebruiker om iets te OPENEN, TONEN of ergens NAARTOE te gaan ("open die in taken", "laat de taken van House of Chi zien", "ga naar de agenda", "open mijn afspraken", "open in afwachting", "naar bronnen/klanten"),
  geef dan een "action" terug en hoef je geen items te maken.
- action.view = een van: "taken" | "agenda" | "afspraken" | "wachter" (= In afwachting) | "bronnen" | "klanten".
- action.client = de exacte klantnaam uit de catalogus om op te filteren (alleen bij "taken"/"wachter"), of laat leeg voor alles.
- Zet "reply" dan kort bevestigend ("Ik open je taken." / "Hier zijn de taken van House of Chi.").
- Geen action? Laat 'm weg of op null.

Antwoord ALTIJD met geldige JSON en niets eromheen:
{"reply":"je bericht aan de gebruiker","done":false,"items":[...],"updates":[...],"removes":[],"appointments":[],"action":{"view":"taken","client":""}}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { history = [], catalog = [], existing = [], appts = [], today, dates = "", who } = req.body || {};
    if (!anthropic) {
      return res.status(200).json({ reply: "(AI staat nog uit — ik heb je input genoteerd.)", items: [], updates: [], removes: [], done: false, noai: true });
    }
    const cat = (catalog || []).map(c => `- ${c.project_id} → ${c.client} · ${c.project}`).join("\n") || "(nog geen klanten/projecten)";
    const ex = (existing || []).slice(0, 90)
      .map(t => `- id:${t.id} | ${t.title} [${t.client || "?"}${t.project ? " · " + t.project : ""}] ${t.owner ? "@" + t.owner : ""}${t.due ? " due " + t.due : ""}`)
      .join("\n") || "(nog geen openstaande taken)";
    const ap = (appts || []).slice(0, 40)
      .map(a => `- ${a.date}${a.start ? " " + a.start : ""} | ${a.title} (${a.kind === "bel" ? "bel" : "fysiek"})${a.contact ? " met " + a.contact : ""}${a.client ? " [" + a.client + "]" : ""}`)
      .join("\n") || "(nog geen afspraken gepland)";
    const sys = `${SYSTEM}\n\nVANDAAG: ${today || ""}\nGEBRUIKER: ${who || ""}\n\nDATUMTABEL (gebruik deze voor alle relatieve dagen):\n${dates}\n\nCATALOGUS (project_id → klant · project):\n${cat}\n\nBESTAANDE OPENSTAANDE TAKEN (met id; voor dubbele-check, werkdruk, en updates/removes):\n${ex}\n\nBESTAANDE AFSPRAKEN (komende; voor dubbele-check):\n${ap}`;
    const messages = (history || []).slice(-24).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })).filter(m => m.content);
    if (!messages.length) return res.status(200).json({ reply: "Waar kan ik mee helpen?", items: [], done: false });

    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 1600, system: sys, messages,
    });
    const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed;
    try { parsed = JSON.parse(slice); }
    catch (_) { parsed = { reply: raw.trim() || "Sorry, dat snapte ik niet helemaal.", items: [], done: false }; }
    return res.status(200).json({
      reply: parsed.reply || "",
      items: Array.isArray(parsed.items) ? parsed.items : [],
      updates: Array.isArray(parsed.updates) ? parsed.updates : [],
      removes: Array.isArray(parsed.removes) ? parsed.removes : [],
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      action: (parsed.action && typeof parsed.action === "object") ? parsed.action : null,
      done: !!parsed.done,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
