// AI-chat endpoint. Praat met Claude, vraagt door bij open eindjes,
// houdt rekening met bestaande taken (dubbele vermijden + werkdruk), en
// geeft de VOLLEDIGE set actiepunten voor het lopende gesprek terug.
//
// Slim: tool-use-loop met (1) Anthropic web search, (2) klant/project aanmaken,
// (3) contact aanmaken, (4) bronnen doorzoeken, (5) contacten doorzoeken.
// Het EINDANTWOORD blijft het bestaande JSON-contract {reply, items, ...}.
import Anthropic from "@anthropic-ai/sdk";
import { svc, logUsage, countWebSearches } from "../lib/usage.mjs";

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

GEREEDSCHAP (tools) die je mag gebruiken:
- web_search: zoek online op als je actuele of externe informatie nodig hebt (bv. een bedrijf opzoeken, openingstijden, een adres, een leverancier). Gebruik spaarzaam.
- create_client_project: maak DIRECT een nieuwe klant (en optioneel project) aan in de database als de gebruiker dat vraagt of als een nieuwe klant/project nodig is. Dit mag je zelf doen.
- create_contact: maak DIRECT een nieuw contact aan (naam + optioneel e-mail/telefoon/bedrijf/rol). Dit mag je zelf doen.
- search_sources: doorzoek binnengekomen berichten/bronnen (mails, appjes) op een zoekterm.
- search_contacts: doorzoek bekende contacten op naam, e-mail of bedrijf.
Let op: alleen KLANTEN/PROJECTEN en CONTACTEN mag je zelf aanmaken. TAKEN en AFSPRAKEN blijven VOORSTELLEN in items/appointments (NIET zelf opslaan).

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

EINDANTWOORD — HEEL BELANGRIJK:
- Als je klaar bent met eventuele tools, geef je je laatste antwoord ALTIJD als geldige JSON en NIETS eromheen (geen uitleg, geen markdown):
{"reply":"je bericht aan de gebruiker","done":false,"items":[...],"updates":[...],"removes":[],"appointments":[],"action":{"view":"taken","client":""}}`;

// --- custom tool-definities (web_search wordt apart als server-tool toegevoegd) ---
const CUSTOM_TOOLS = [
  {
    name: "create_client_project",
    description: "Maak een nieuwe klant (en optioneel project) aan in de database. Gebruik dit als er een nieuwe klant/project nodig is.",
    input_schema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Naam van de klant" },
        project: { type: "string", description: "Optionele projectnaam" },
      },
      required: ["client"],
    },
  },
  {
    name: "create_contact",
    description: "Maak een nieuw contact aan (extern persoon). Upsert op e-mail indien aanwezig.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        company: { type: "string" },
        role: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "search_sources",
    description: "Doorzoek binnengekomen berichten/bronnen (mails, appjes) op een zoekterm.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "search_contacts",
    description: "Doorzoek bekende contacten op naam, e-mail of bedrijf.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
];

const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search", max_uses: 5 };

// Voer één custom tool uit; geeft een korte tekst terug. Markeert of er iets is aangemaakt.
async function runTool(db, name, input, flags) {
  try {
    if (name === "create_client_project") {
      if (!db) return "Database niet beschikbaar.";
      const client = String(input?.client || "").trim();
      if (!client) return "Geen klantnaam opgegeven.";
      const project = String(input?.project || "").trim();
      const { count } = await db.from("projects").select("id", { count: "exact", head: true });
      const row = {
        client,
        project: project || null,
        color: "#fbbf24",
        icon: (client[0] || "?").toUpperCase(),
        sort: (count || 0) + 1,
      };
      const { data, error } = await db.from("projects").insert(row).select().single();
      if (error) return "Kon klant niet aanmaken: " + error.message;
      flags.refresh = true;
      return `Aangemaakt: klant "${data.client}"${data.project ? ' · project "' + data.project + '"' : ""} (id ${data.id}).`;
    }

    if (name === "create_contact") {
      if (!db) return "Database niet beschikbaar.";
      const cName = String(input?.name || "").trim();
      if (!cName) return "Geen naam opgegeven.";
      const email = String(input?.email || "").trim().toLowerCase();
      const row = {
        name: cName,
        email: email || null,
        phone: String(input?.phone || "").trim() || null,
        company: String(input?.company || "").trim() || null,
        role: String(input?.role || "").trim() || null,
      };
      if (email) {
        const { data, error } = await db.from("contacts").upsert(row, { onConflict: "email" }).select().single();
        if (error) return "Kon contact niet aanmaken: " + error.message;
        flags.refresh = true;
        return `Contact opgeslagen: ${data.name}${data.email ? " <" + data.email + ">" : ""}.`;
      }
      const { data: existing } = await db.from("contacts").select("id, name").ilike("name", cName).maybeSingle();
      if (existing) return `Contact "${existing.name}" bestaat al.`;
      const { data, error } = await db.from("contacts").insert(row).select().single();
      if (error) return "Kon contact niet aanmaken: " + error.message;
      flags.refresh = true;
      return `Contact aangemaakt: ${data.name}.`;
    }

    if (name === "search_sources") {
      if (!db) return "Database niet beschikbaar.";
      const q = String(input?.query || "").trim();
      if (!q) return "Geen zoekterm.";
      const like = `%${q}%`;
      const { data, error } = await db
        .from("sources")
        .select("id, sender, subject, body, received_at")
        .or(`subject.ilike.${like},sender.ilike.${like},body.ilike.${like}`)
        .order("received_at", { ascending: false })
        .limit(8);
      if (error) return "Zoeken mislukt: " + error.message;
      if (!data || !data.length) return "Geen bronnen gevonden voor: " + q;
      return data.map(s => {
        const dt = s.received_at ? String(s.received_at).slice(0, 10) : "";
        const snip = (s.body || "").replace(/\s+/g, " ").trim().slice(0, 120);
        return `- id:${s.id} | ${dt} | ${s.sender || "?"} | ${s.subject || "(geen onderwerp)"} | ${snip}`;
      }).join("\n");
    }

    if (name === "search_contacts") {
      if (!db) return "Database niet beschikbaar.";
      const q = String(input?.query || "").trim();
      if (!q) return "Geen zoekterm.";
      const like = `%${q}%`;
      const { data, error } = await db
        .from("contacts")
        .select("id, name, email, phone, company, role")
        .or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`)
        .limit(8);
      if (error) return "Zoeken mislukt: " + error.message;
      if (!data || !data.length) return "Geen contacten gevonden voor: " + q;
      return data.map(c =>
        `- ${c.name}${c.company ? " (" + c.company + ")" : ""}${c.role ? " · " + c.role : ""}${c.email ? " <" + c.email + ">" : ""}${c.phone ? " " + c.phone : ""}`
      ).join("\n");
    }

    return "Onbekende tool: " + name;
  } catch (e) {
    return "Tool-fout: " + String(e.message || e);
  }
}

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

    const db = svc();
    const tools = [WEB_SEARCH_TOOL, ...CUSTOM_TOOLS];
    const flags = { refresh: false };
    let totalIn = 0, totalOut = 0, totalWeb = 0;
    let resp = null;

    // Tool-use-loop. Bij fout: terugvallen op een gewone call (huidig gedrag).
    try {
      const convo = messages.slice();
      const MAX_ITERS = 5;
      for (let i = 0; i < MAX_ITERS; i++) {
        resp = await anthropic.messages.create({
          model: MODEL, max_tokens: 1600, system: sys, tools, messages: convo,
        });
        totalIn += resp?.usage?.input_tokens || 0;
        totalOut += resp?.usage?.output_tokens || 0;
        totalWeb += countWebSearches(resp);

        if (resp.stop_reason !== "tool_use") break;

        // Voer custom tool_use-blokken uit (web_search is al door de API gedaan).
        const toolResults = [];
        for (const block of resp.content || []) {
          if (block.type !== "tool_use") continue;
          if (block.name === "web_search") continue; // server-tool, niet handmatig
          const out = await runTool(db, block.name, block.input, flags);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out });
        }
        // Assistant-beurt + tool_results terugvoeren.
        convo.push({ role: "assistant", content: resp.content });
        if (toolResults.length) {
          convo.push({ role: "user", content: toolResults });
        } else {
          // Alleen server-tool (web_search) gebruikt: laat het model verdergaan.
          convo.push({ role: "user", content: "Ga verder en geef nu je eindantwoord als JSON." });
        }
      }
    } catch (toolErr) {
      // Fallback: simpele call zonder tools (oorspronkelijk gedrag).
      try { console.error("chat tool-loop fout:", toolErr.message); } catch (_) { /* ignore */ }
      try {
        resp = await anthropic.messages.create({ model: MODEL, max_tokens: 1600, system: sys, messages });
        totalIn += resp?.usage?.input_tokens || 0;
        totalOut += resp?.usage?.output_tokens || 0;
      } catch (e2) {
        return res.status(500).json({ error: String(e2.message || e2) });
      }
    }

    // Verbruik loggen (faalt stil).
    await logUsage(db, { source: "chat", model: MODEL, inputTokens: totalIn, outputTokens: totalOut, webSearches: totalWeb });

    const raw = (resp?.content || []).map(b => (b.type === "text" ? b.text : "")).join("");
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
      refresh: !!flags.refresh,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
