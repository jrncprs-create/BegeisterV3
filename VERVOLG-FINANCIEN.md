# Begeister — Overdracht Financiën-ronde (voor vervolgchat)

**Laatste versie (klaar om te deployen):** v130 (versiechip rechtsboven). Vorige live: v129.
**Deploy-flow:** GitHub web-upload van `public/index.html` (evt. `api/*.mjs`, `server.mjs`) naar repo `jrncprs-create/BegeisterV3`, branch `main` → Railway redeployt automatisch. Sandbox heeft geen push-rechten; uploaden gaat via Chrome (github.com/jrncprs-create/BegeisterV3/upload/main/public). Na commit ~1 min wachten + hard herladen (⌘⇧R).

## Infra / ID's
- Supabase project-ref: `rwevsqwvgqbzypaudzuj`
- Railway project `27b6aae8-8811-4ffc-9e0b-038f29edd0dd`, service `e2e28683-dbbe-44bf-b93d-b398820b9197`, env `4ed261df-9bb2-4f63-b074-b83eb55893c7`
- Hoofdbestand: `public/index.html` (~544KB, één file, vanilla JS, geen build). Script-validatie: node one-liner die alle inline `<script>` blokken door `new Function()` haalt.
- Transcriptie via Groq Whisper (`api/transcribe.mjs`, `lib/transcribe.mjs`); AI-extractie via Anthropic (`intake/extract.mjs`, model `claude-sonnet-4-6`).
- Nieuw endpoint: `api/scanbudget.mjs` ("Budget uit bronnen" — leest gekoppelde bronnen per project, stelt projectprijs/klantbudget voor). Gemount in `server.mjs`.

## DB-wijzigingen die al gedaan zijn
- `projects.invoice_status text`, `projects.invoice_date date` (factuurstatus: concept/geoffreerd/gefactureerd/betaald).
- `_mapProj` in index.html neemt nu ook mee: `projectprijs, btw, budget, notes, invoice_status, invoice_date` (waren eerder weg na reload).

## Financiën-pagina — huidige stand (v129)
Layout: kolom 1 = `#financienWrap` (Klanten-stijl lijst, klant→projecten, openklappen via `_kClientOpen`). Kolom 2 = `#finMidWrap` (`#view-finmid`). Kolom 3 = `#finRightWrap` (`#view-finright`).
- **Toestand A** (geen project geselecteerd): Begeister-totaal hero + "Uitgaven per maand" + cashflow-kern (Nog te factureren/Openstaand/Ontvangen) + Winst per klant + Nog in te kopen + Recente boekingen + Zonder project.
- **Toestand B** (project geselecteerd): `.finB-flat` = `pb-inline pb-board-inline` (zelfde vlakke board-stijl als Klanten), met donut + Inkomsten/Kosten/Winst, sectie "Offerte & Factuur" (statuspills + openstaand + tekstknoppen "offerte/factuur toevoegen"), sectie "Prijs & budget", knop "Budget uit bronnen halen". Kolom 3 = bestellijst (`secBestel` via `_renderProjBoard`).

### Rekenlogica (belangrijke afspraken met Jeroen)
- **Terminologie:** Inkomsten · Kosten · Winst (niet Omzet/Marge).
- **Kosten tellen pas mee als betaald** (inkoop-artikel afgevinkt/`done`). Niet-afgevinkt = "nog in te kopen" (`_finOpenInk`/`_finUp`), telt nog niet in de winst.
- **Inkomsten/winst tellen pas mee vanaf status *Geoffreerd*** (concept telt niet in totalen; in de lijst toont concept de status i.p.v. winst).
- **Begeister is geen klant → intern/overhead:** niet in "Winst per klant" of inkomsten-totalen; eigen kosten apart als "intern €…" in de hero (`overhead`).
- **Donut** (`_finDonut`): ring = behouden winst-aandeel → vol in klantkleur bij 0 kosten, leegt bij kosten, volle rode ring bij verlies, geen los grijs puntje. **Zonder tekst in het midden** (bedrag/label weggehaald).
- Amazon-prijzen zijn incl. btw → bestellijst-totaal toont incl. met "excl. €…" klein eronder.
- Lege klant/project (geen prijs/budget/inkoop) niet meer in de Financiën-lijst.

### Bestelregel (`inkRow`) — huidige stand
- Naam in klantkleur (`.pb-itxlink` → `var(--scol)`); geen dubbele "×N" meer.
- Hoofdbedrag rechts = **totaal** (qty×eenheid); klein eronder "N × €eenheid" (eenheid blijft bewerkbaar `.pb-punitin`).
- Klik op artikel → directe productlink (`x.url`), anders zoeken bij de webshop van de plaklijst (Amazon/Bol via bron-url), anders Amazon.nl. Helper `_inkHref(x)`. **Niet meer Google.**
- Afbeelding = **zwevende preview aan de muispointer** (`#pbThumbFloat`, `_pbThumbInit()`, rijen krijgen `data-img`). Geen inline thumbnail meer.
- Namen links, € + prijzen rechts uitgelijnd.

## AF in v130 (klaar om te deployen) — alle 6 punten
1. ✅ **Lijntjes/balk opschonen:** `.finB-scan` grijze border-top weg (was dubbele lijn met `.finB-scansec`); eerste `.pb-sec` in `.finB-flat` geen dubbele lijn onder de header meer; sectie-borders één dunne klantkleur-lijn (`color-mix(--scol 30%,transparent)`). Budgetbalk `.finB-budbar` alleen bij `budPct>0` + track nu klantkleur-tint i.p.v. grijs. **btw/excl-woordjes weg** in héél de Financiën-weergave: "excl. btw" weg uit Prijs&budget (alleen "incl. €…"), "Inkomsten (excl.)/Kosten (excl.)" → "Inkomsten/Kosten", bestellijst-totaal subtekst "incl. btw · excl. €X" → "excl. €X". Kolom 3: `.pb-besteltot` border klantkleur-transparent, `#finRightWrap .pb-in`/`.pb-sec` add-row lijnen in klantkleur.
2. ✅ **Offerte & Factuur intake-routing:** front-end toont nu automatisch de intake-offertes/facturen die al aan een project hangen (`source.project_id`) in de "Offerte & Factuur"-sectie, met label Offerte/Factuur en klik→preview (via bestaande `openAttachment`). Detectie via `_docKind` (subject/summary/bestandsnaam). Backend-vangnet in `intake/poller.mjs`: als items géén project_id gaven, matcht het de door Claude herkende `client`/`project` tegen de catalogus zodat het document tóch aan het juiste project hangt. LET OP: `intake/poller.mjs` moet mee-geüpload worden en met een test-mail geverifieerd.
3. ✅ **Bestanden-preview** vult nu volle breedte kolom 2+3 (`grid-column:1/-1` op `.main.workspace #view-filespreview`).
4. ✅ **Contacten slim per klant:** resolver `_contactClientMap`/`_contactClientOf` koppelt elk contact aan een bekende klant via bedrijfsnaam/naam-match, e-maildomein en domein-overerving (vrije mailproviders uitgesloten). Display-only — schrijft niets naar de DB, dus veilig/omkeerbaar. Reden dat het eerder faltte: de contact-modal bewaart de klant in `company`, terwijl de lijst op `client` groepeerde → nu via resolver opgelost.
5. ✅ **Bronnen → Klanten-indeling:** kolom 1 = klanten (`#bronnenWrap`, con-crow-stijl), kolom 2 = bronnen per klant (`#view-bronmid`/`bronMidWrap`, con-li), kolom 3 = preview (`#view-bronright`/`bronRightWrap`, hergebruikt `.fmp-*` + signed-URL). Nieuwe functies: `renderBronnen`/`renderBronMid`/`renderBronRight`/`selectBronClient`/`selectBronSrc`/`_bronClientOf`. `gotoSource` bijgewerkt naar de nieuwe selectie. 'bronnen' uit `_railHintViews`; oude popup/list-code (`_renderSrcList` etc.) blijft ongebruikt staan.
6. ✅ **Menu:** Archief-knop weg (view/functies blijven, alleen nav-item weg); Plakken is nu een icoon-picto (`.nav-picto`, `#clipBtn`) ná Meldingen; op mobiel toont het label "Plakken". Functie ongewijzigd (`pasteAsSource()` → drop-pipeline van het dashboard).

## Nog te verifiëren op de live app (na deploy)
- Bronnen 3-koloms flow op desktop (desk3) en of preview/attachments laden.
- Contacten-groepering met de echte data (of de heuristiek de juiste klanten pakt; anders drempels bijstellen in `_contactClientMap`).
- Intake offerte/factuur end-to-end met een test-mail (poller-vangnet + weergave in Offerte & Factuur).

## Gedragsafspraken met Jeroen
- Gedraag je als senior UI/UX-designer, neem initiatief, gooi beslissingen niet steeds terug.
- Controleer je eigen werk (script-validatie + zelf de flow nalopen).
- Financiën-pagina moet minstens zo goed zijn als de Klanten-pagina.
- Kleur: geen groen als winst-indicator; Begeister = wit/lichtgrijs; per klant een eigen accentkleur (donut/lijnen/tekst in klantkleur). Bedragen rechts uitgelijnd, btw/subteksten klein eronder.
- GROQ/secret keys nooit zelf invullen — alleen de variabelenaam; Jeroen vult secrets zelf in.
