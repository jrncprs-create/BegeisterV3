# Begeister — componentinventaris

Alle interactieve onderdelen die de app gebruikt, met de gedragskeuzes die er in de loop
van de bouw voor zijn gemaakt. Uit de code getrokken en in de draaiende app gemeten, niet
bedacht. Peildatum 10 juli 2026, v195.

Bedoeld als agenda voor Claude Design. De dubbelingen die erin zaten zijn inmiddels
rechtgetrokken — zie het hoofdstuk onderaan.

---

## Knoppen

| Component | Klasse | Verschijning |
|---|---|---|
| Standaardknop | `.btn` | Transparant, 1 px rand, radius 9, nadrukgewicht |
| Stille knop | `.btn.ghost` | Idem, tekst in `--mut` |
| Gevaarknop | `.btn.danger` | Tekst rood, rand donkerrood |
| Icoonknop | `.iconbtn` | Alleen icoon; varianten `.save` en `.del` |
| Rijknop | `.pb-hadd`, `.pb-ai` | Klein, in een sectiekop |
| Zwevende rijknop | `.pb-move`, `.pb-del` | `opacity: 0`, verschijnt bij hover op de rij |
| Chip-knop | `.finB-pill` | Vervallen in v193 — de fasebalk zei hetzelfde |
| Kolombalkknop | `.cb-add`, `.cb-toggle`, `.cb-close` | Alleen desktop, in een kolomkop |

**Gedragskeuzes**

- Er is **geen gevulde primaire knop**. Alles is outline. De hiërarchie zit in plaatsing, niet in vulling.
- Destructieve knoppen zijn **onzichtbaar tot je hovert** over de regel waar ze bij horen.
- Een knop die iets onomkeerbaars doet, vraagt eerst. Zie *Bevestiging in situ*.
- Knoppen die AI aanroepen dragen altijd de asterisk. Zonder uitzondering.

---

## Keuzevelden

| Component | Klasse | Wat het is |
|---|---|---|
| Custom dropdown | `.cdd` + `.cdd-menu` | Vervangt `<select>` volledig |
| Native select | `.dz-sel` | Nog één plek: de compacte balk in de sleepzone |
| Autocomplete | `.acwrap` + `.acmenu` | Contactnaam, filtert tijdens typen |
| Mention-menu | `#cmtMenu` | `@naam` in opmerkingen |
| Kleurkiezer | `.cpop` | 4-koloms swatchraster |

**Gedragskeuzes**

- De custom dropdown klapt **fixed** open (`.cdd-menu-fixed`) zodra hij anders buiten beeld valt. Hij kiest zelf of hij naar boven of naar beneden opent en klemt zijn hoogte op 62 vh. Dit is in v167 gebouwd omdat menu's onder de vouw verdwenen.
- De chevron draait 180° bij openen.
- Geselecteerde optie: `background: rgba(255,255,255,.10)`. Hover: `.06`.

---

## Invoervelden

| Component | Klasse | Vorm |
|---|---|---|
| Tekstveld | `input` | Rand rondom, radius 9 |
| Onderstreept veld | `.pb-in` | Alleen onderlijn — voor "+ toevoegen…" |
| Bedragveld | `.pb-price` | Rechts uitgelijnd, tabular-nums, vaste breedte 66 px |
| Notitieveld | `.pb-notes` | Rand rondom, `resize: vertical` |
| Omschrijvingsveld | `.pb-oms` | Groeit mee met de tekst, geen scrollbalk, geen sleepgreep |
| Datumveld | `.datefield` | Leest als een veld, opent een kiezer |
| Tijdveld | `.datefield` | Idem |

**Gedragskeuzes**

- Bedragen: **euroteken in een vaste kolom van 9 px, bedrag in een vaste kolom van 66 px**, alles eindigend op de rechterrand van het paneel. Rijen, totaal en excl.-regel delen dezelfde twee kolommen. Dit heeft drie iteraties gekost.
- Binnen een klantcontext krijgt elk veld de klantkleur, ook de onderlijn (op 30 %).
- Een veld dat opslaat, doet dat op `blur`, niet op elke toetsaanslag.

---

## Kiezers (popovers)

| Component | Klasse | Bijzonderheid |
|---|---|---|
| Datumkiezer | `.duepop` | Voor taken: één klik. Voor afspraken: **twee klikken = periode** |
| Tijdkiezer | `.timepop` | Eigen wielloze kolommen; geen iOS-wiel |
| Kleurkiezer | `.cpop` | Uniek per klant; kleuren die al bezet zijn worden overgeslagen |

**Gedragskeuzes voor de datumkiezer**

- Taak → klik = datum, popover sluit.
- Afspraak → klik 1 zet de begindag en de popover **blijft open**; klik 2 zet de einddag. Dezelfde dag nogmaals klikken = eendaags. De dagen ertussen krijgen `.reeks`.
- Onder de kalender staat een hint die meegaat met de stand: "Kies de eerste dag. Meerdaags? Klik daarna de laatste."
- De popover positioneert zichzelf boven het veld als hij er anders onderuit valt.

---

## Overlays

| Component | Wat |
|---|---|
| `.overlay` + `.modal` | Standaardvenster, gecentreerd |
| `.overlay.incol` | Op desktop: opent **in de derde kolom**, niet gecentreerd |
| `#welcomeOverlay` | Beginscherm; komt naar voren als de AI iets vraagt |
| `#aiInsightOverlay` | AI-inzicht bij een bestand of bron |
| `#cmtOverlay` | Opmerkingen |
| Bestandsviewer | `.fv` | Fullscreen; PDF, beeld, docx |

**Gedragskeuzes**

- Klikken op de achtergrond sluit. Behalve bij formulieren met invoer.
- Op een breed scherm opent een venster **niet in het midden** maar in de rechterkolom, zodat de context zichtbaar blijft.
- Het welkomstscherm komt **alleen naar voren bij de eerste lading** of als het al open stond. Nooit midden in een bulkactie — dat gooide je terug naar het hoofdscherm.

---

## Bevestiging

| Patroon | Waar |
|---|---|
| `uiConfirm()` | Modaal venster met titel, Annuleren, actieknop |
| Bevestiging in situ | Prullenbakje wordt "Zeker?" |
| `toonToast()` | Melding linksonder na een gelukte of mislukte actie |

**Gedragskeuze:** de in-situ variant is de voorkeur. Het prullenbakje verandert in het
woord "Zeker?" in rood, op dezelfde plek, en valt na **4 seconden** terug. Geen dialoog,
geen focusverschuiving. Dit staat nu op de Postvak In-rij en de vraag-overlay.

De modale variant blijft voor bulkacties, waar de tekst uitlegt wat er gebeurt en hoeveel
items het betreft.

---

## Lijsten en rijen

| Component | Klasse |
|---|---|
| Taakregel | `.pb-row` |
| Bestelregel | `.pb-row.pb-ink` |
| Bestandsrij | `.kfile` |
| Bronregel | `.pv-row` |
| Contactregel | `.con-li` |
| Agendaregel | `.evrow` |
| Afgevinkt | `.pb-donerow` |

**Gedragskeuzes**

- Een rij heeft **geen zichtbare acties tot je hovert**. Daarna verschijnen ze rechts, absoluut gepositioneerd zodat ze de inhoud niet verschuiven.
- Afvinken = archiveren. De rij fadet weg en de rest sluit soepel aan (`height .42s`).
- Afgevinkte items klappen samen in één rij met een teller.
- Hover geeft `rgba(255,255,255,.02)` — nauwelijks zichtbaar, wel voelbaar.

---

## Vinkjes en schakelaars

| Component | Vorm |
|---|---|
| Checkbox | `.pb-chk` — afgeronde vierkante outline in de klantkleur, geen witte vulling |
| Statusschakelaar | De regel *Openstaand / Voldaan* is zelf de knop |

**Gedragskeuze:** er zijn geen toggles of switches in de app. Een status wissel je door
op de status te klikken. In v193 zijn vier statuspillen (Concept / Geoffreerd /
Gefactureerd / Betaald) vervangen door één klikbare regel, omdat de fasebalk hetzelfde
al zei.

---

## Voortgang

| Component | Klasse |
|---|---|
| Fasebalk | `.pb-fase` |
| Bal-vlaggetje | `.pb-vlag` |
| Marge-ring | `.fd-ring` |
| Budgetbalk | `.finB-budbar` |

**Gedragskeuzes**

- De fasebalk is een dun spoor van 2 px met één dicht bolletje van 8 px op de huidige fase. Gevuld deel = klantkleur.
- Klik dezelfde fase nogmaals = één stap terug.
- Boven het bolletje hangt een vlaggetje: **klantnaam als de bal bij de klant ligt**, "Begeister" eronder als hij bij ons ligt. Wachten we op een ander, dan is het bolletje omringd door een zachte halo.
- Interne en privéprojecten hebben **geen** fasebalk, geen offerte, geen factuur.

---

## Mappen en groepen

| Component | Klasse |
|---|---|
| Map | `.pb-map` + `.pb-maph` |
| Financiënmap | `.pb-map-fin` — Offertes / Inkoop / Facturen |
| Submap | `.pb-map-sub` |
| Sectie | `.pb-sec` + `.pb-h` |

**Gedragskeuzes**

- Mapkoppen dragen de klantkleur; de chevron draait 90° → 0° bij inklappen.
- **Lege mappen blijven zichtbaar.** Financiën staat er altijd, ook zonder bestanden — anders weet je niet waar je iets naartoe sleept.
- Een bestand staat nooit op twee plekken. Wat in een financiënmap valt, valt uit de typemappen.

---

## Feedback

| Component | Wat |
|---|---|
| Denkanimatie | `thinking.webp` + wisselende statusregel |
| Foutregel | `.fvai-err` — wat er misging, plus "Opnieuw" |
| Melding | Push, één per binnengekomen bericht, met AI-samenvatting |
| Teller | `.pb-donecnt`, `.badge` |

**Gedragskeuze:** tijdens het laden wisselt de tekst elke 1,5 s tussen concrete stappen
("Bestand ophalen…", "Kernpunten samenvatten…"). Niet "Even geduld". Een fout zegt wat er
misging en biedt precies één uitweg.

---

## Beeld en bestanden

| Component | Klasse |
|---|---|
| Fotostapel | `.bs-thumb` + `.bs-nav` + `.bs-tel` |
| Bestandsviewer | `.fv-stage` |
| Docx-vel | `.dox-wrap` — wit vel papier, max 760 px |
| Zwevende thumbnail | `#pbThumbFloat` — volgt de muis bij een bestelregel |

Eén gedeelde onderlaag (`_bestandUrl`, `_bestandPreviewHTML`) bepaalt overal hoe je aan een
bestand komt en hoe het getoond wordt. Die verving zes losse URL-bouwers en vijf renderers.

---

## Navigatie

| Component | Gedrag |
|---|---|
| Topnav | Verbergt items per breedte; "Planning" is de paraplu op mobiel |
| Rail (kolom 1) | Wordt overgenomen door Bronnen / Klanten / Financiën / Contacten / Bestanden / Postvak In |
| Werkblad | Desktop ≥ 1001 px: drie gelijke kolommen |
| Kolombalk | `.colbar` — alleen desktop |

**Gedragskeuze:** één pagina mag de hele werkbank innemen (`grid-column: 1 / -1`). Dat doen
het projectbord en Postvak In. Een lege kolom naast een lijst is een fout, geen layout.

---

## Bijna-dubbelingen — gevonden en rechtgetrokken (v194)

Gecontroleerd in de code, niet vermoed. Twee families bleken vier of twee varianten van
hetzelfde ding te zijn.

### Tekstknoppen — was vier, is één

| Was | Radius | Font | Padding | Hover |
|---|---|---|---|---|
| `.btn` | 10 px | 13.5 | 9×15 | `background: rgba(255,255,255,.05)` |
| `.btn.newappt` | 11 px | 13.5 | 9×15 | idem + `border-color: #3a3a3a` |
| `.fv-btn` | 9 px | 13 | 7×12 | `border-color: #fff` |
| `.insp-btn` | 9 px | 13 | 7×12 | `color: #fff; border-color: --mut2` |
| `.pb-ai` | 8 px | 12 | 3×10 | `color: #fff; border-color: --mut2` |

Vijf regels, vier radii, drie fontgroottes, drie verschillende hovers — voor precies
hetzelfde gebaar: een transparante knop met een rand.

**Nu:** één basis (radius 9, transparant, 1 px rand, één hover: `color: #fff`,
`border-color: --mut2`) en drie maten die alleen in padding en fontgrootte verschillen.

| Maat | Klasse | Font | Padding |
|---|---|---|---|
| M | `.btn` | 13.5 | 9×15 |
| S | `.fv-btn`, `.insp-btn` | 13 | 7×12 |
| XS | `.pb-ai` | 12 | 3×10 |

Modifiers: `.ghost` (gedempte tekst), `.danger` (rood). `.btn.newappt` is verdwenen —
het was een letterlijke kopie van `.btn`.

### Icoonknoppen — was twee, is één

`.iconbtn` (afgerond vierkant, radius 11, padding 6) en `.wbtn` (rond, padding 3) deelden
alles: transparant, geen rand, `rgba(255,255,255,.6)`, hover naar wit met een schaalsprong.
Alleen hun schaalfactor verschilde onbedoeld (1.06 vs 1.08) en hun active-state (`opacity`
vs `transform`).

**Nu:** één basis, één hover (`scale(1.07)`), één active (`scale(.94)`). Het enige verschil
is de vorm: `.iconbtn` radius 9, `.wbtn` radius 50 %.

---

## Alles rechtgetrokken (v195)

Op verzoek doorgevoerd. Elk punt gemeten in de live app, niet aangenomen.

### 1. Tekstgewicht — één regel maakte alles dood

Op regel 35 stond `*{font-weight:300!important}`. Daardoor rendeerde **de hele app op
gewicht 300** en waren alle 138 `font-weight`-declaraties (400, 500, 600, 650, 700, 800)
dode code. Alleen drie regels met een eigen `!important` ontsnapten.

Nu twee gewichten, als tokens:

```css
--fw: 300;          /* basis */
--fw-nadruk: 500;   /* sectiekoppen, bedragen, rijtitels, badges */
```

Alles wat 600 of hoger was, is nadruk geworden. Alles daaronder erft de basis. Gemeten na
deploy: `body` = 300, `#who` = 500. Het gewicht is weer een keuze.

### 2. Fontgroottes — acht maten onder 15 px, nu vier

`10.5 → 11`, `11.5 → 12`, `12.5 → 13`, `13.5 → 14`. Dat zijn 156 declaraties. De schaal
onder 15 px is nu **11 / 12 / 13 / 14**.

### 3. Radius — acht waarden, nu vier

`3,4,5,6,7 → 6` · `8,9,10 → 9` · `11,12,13,14,15,16 → 12` · pillen blijven `999`.
109 declaraties aangepast. Tokens: `--r-sm: 6px`, `--r-md: 9px`, `--r-lg: 12px`, `--r-pil: 999px`.

### 4. Focus — was er niet

De app had **nul** focus-states. Wie met het toetsenbord navigeerde zag niets. Eén ring
voor alles: geen `outline` maar een dubbele `box-shadow` (eerst achtergrondkleur, dan
`--mut2`), zodat hij netjes binnen afgeronde hoeken valt.

### 5. Uitgeschakeld — was JavaScript

Drie plekken zetten `btn.style.opacity = '.6'` vanuit JS, veertien plekken zetten
`disabled = true` zonder stijl. Nu één CSS-regel: `opacity .45`, `pointer-events: none`.

### 6. Lege staten — vijf klassen, één stem

`.pb-empty`, `.pb-mapleeg`, `.kfiles-hint`, `.pv-leeg`, `.fin-mid-hint` zeiden hetzelfde op
vijf manieren. Nu één basis (gedempt, klein, geen kader); alleen de padding verschilt met
de plek.

### 7. Toast — bestond niet

Een gelukte actie werd nergens bevestigd. Nieuw: `toonToast(tekst, soort)` — linksonder,
vier seconden, geen knop, `soort: 'fout'` voor rood. In gebruik bij bron verwijderen,
bulk-triage en afspraak opslaan. Vervangt ook de laatste `alert()` in de app.

### 8. Dropdowns — twee soorten, nu één

`_uniformeSelects(scope)` vervangt elke `<select>` door de custom `.cdd`. De native select
blijft bestaan als verborgen waardehouder, zodat `onchange` en `.value` blijven werken.
Doorgevoerd op: Postvak In (22 rijen, gemeten), `a_kind`, `m_status`, `c_client`, `c_role`,
`insp_board`.

**Eén uitzondering, bewust:** `.dz-sel` in de sleepzone. Dat is een compacte inline-balk,
geen formulierveld — de blok-dropdown zou hem breken. Dit is de enige plek waar de app nog
een zichtbare native select toont.

### 9. Kleurtokens — de eerste `:root` loog

`--txt`, `--mut`, `--mut2`, `--ink`, `--primary2` en `--ok` stonden twee keer, met
verschillende waarden. De tweede definitie (het kleur-states-blok) won altijd. De dode
waarden zijn weg: tekstkleur wordt nu op één plek bepaald.

---

## Wat nog openstaat


Wat ik niet eenzijdig heb aangeraakt:

1. **Vier soorten invoerveld.** Rand rondom, alleen onderlijn, rechts-uitgelijnd bedrag, meegroeiende textarea. Ze zijn functioneel verschillend — maar hun randkleur en focusgedrag zijn dat niet consequent. Hier zou ik een ontwerpbesluit willen in plaats van een zoek-en-vervang.
2. **Skeletons.** Er is één laadanimatie (`thinking.webp`) en verder niets. Lijsten verschijnen zonder tussenstand.
3. **`.dz-sel`.** De laatste native select, bewust gelaten. Zie hierboven.
4. **Kleurtokens heten nog `--s1` t/m `--s4`.** Dat werkt, maar de namen zeggen niets. Hernoemen raakt honderden regels en hoort in een aparte ronde.
5. **Iconen zijn losse SVG-strings in JavaScript.** Ze zijn stilistisch consistent (Tabler outline), maar er is geen sprite en geen registratie.

Wat is doorgevoerd staat hierboven onder *Alles rechtgetrokken (v195)*.
