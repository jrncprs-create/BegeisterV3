// Genereert één verse, persoonsgebonden one-liner (AI-humor) voor het beginscherm.
import Anthropic from "@anthropic-ai/sdk";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { who = "", partner = "", busy = "", openCount = 0, partnerOpen = 0, partnerDone = [], projects = [] } = req.body || {};
    if (!anthropic) return res.status(200).json({ text: "" });
    const projlist = (projects || []).map(p => typeof p === "string" ? p : `${p.client || ""}${p.project ? " · " + p.project : ""}`).filter(Boolean).join(", ") || "(geen)";
    const profiel = who === "Marlon"
      ? `MARLON werkt op het snijvlak van live experience, hospitality, productie en organisatie. Ze denkt in mensen, sfeer, timing, ontvangst, programma en flow; haar kracht is aanvoelen wat nodig is zodat mensen zich openen, verbinden of bewegen. Thema's: aandacht, ontmoeting, bedding, gastvrijheid, intuïtie, vertrouwen, timing, ruimte maken, menselijke energie, live momenten, organisatie als onzichtbare structuur.`
      : `JEROEN is kunstenaar, ontwerper en maker. Hij werkt met licht, techniek, installaties, objecten, decor, oude materialen, autonome systemen en hergebruik — bouwen met de handen. Hij houdt van experiment, tactiele materialen, oude apparaten, systemen die gedrag krijgen. Thema's: maken, experiment, materiaal, licht, techniek, bouwen, falen/proberen, autonomie, ambacht, verbeelding, oude dingen nieuw leven geven, kunst als onderzoek.`;
    const sys = `Schrijf ÉÉN korte, inspirerende one-liner in het Nederlands voor het beginscherm van Klara — de rustige, slimme werkplek van Marlon en Jeroen (samen: Begeister, makers van live ervaringen waarin sfeer, mensen, plek, licht, techniek en organisatie samenvallen).
Gericht aan ${who}. ${profiel}

Het is een kleine richtinggever voor de dag: creatief, scherp, warm, makerig. Voel als een maker/kunstenaar/ontwerper/denker (in de geest van makers als Rick Rubin, niet als manager).
Put vooral uit de thema's van ${who} hierboven; soms mag het gaan over samen maken voor een publiek of het moment waarop alles samenvalt.

Regels:
- Maximaal ~18 woorden. Liever kort en krachtig dan uitleggerig.
- Niet corporate, niet zweverig, niet cliché. Vermijd versleten zinnen zoals "creativity takes courage".
- Schrijf een ORIGINELE zin in die geest; verzin geen quote en plak er geen beroemde naam op (geen misattributie).
- Geen emoji, geen aanhalingstekens. Noem nooit de dag/datum/weer als hoofdthema. Nooit iets ten nadele van ${who} of ${partner}.
- Mag ${who} bij naam aanspreken, maar hoeft niet — een mooie spreukachtige richtinggever zonder naam mag ook.
- Soms (niet altijd) mag een projectnaam meeklinken: ${projlist}.
Geef ALLEEN de zin terug, niets eromheen.`;
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 120, system: sys,
      messages: [{ role: "user", content: `Geef een frisse, inspirerende one-liner voor ${who}. Variatie ${Math.random().toString(36).slice(2, 7)}.` }],
    });
    const text = resp.content.map(b => (b.type === "text" ? b.text : "")).join("").trim().replace(/^["']+|["']+$/g, "");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
