# Begeister — designtaal

Grondstof voor het brandbook. Alles hieronder is uit de code getrokken en in de draaiende
app gemeten (`getComputedStyle`), niet bedacht of onthouden. Peildatum 10 juli 2026, v209.

Dit vervangt `BRANDBOOK-ASSETS.md`. Zie **Correcties** onderaan: drie dingen in dat
document waren aantoonbaar onwaar. Als die al in Claude Design staan, haal ze eruit.

Voor de *functionele* onderdelen (knoppen, dropdowns, overlays, lege staten) is er een
apart document: `COMPONENTEN.md`. Dit document gaat over de taal, dat over de bouwstenen.

---

## 1 · Merk

Het merk is één vorm: een asterisk van drie rechte lijnen die elkaar in één punt kruisen.
Geen vulling, geen bocht. Het woordmerk is diezelfde asterisk met "Begeister" ernaast in
outline-letters.

| Bestand | Wat het is | Formaat |
|---|---|---|
| `begeister-symbol.svg` | Beeldmerk, los | viewBox `0 0 147.39 172.8` |
| `begeister-logo.svg` | Woordmerk incl. asterisk | viewBox `0 0 294.78 55.06` |
| `icon-512.png` / `icon-192.png` | App-icoon | PWA |
| `apple-touch-icon.png` | App-icoon | iOS |
| `favicon-32.png` | Favicon | 32×32 |

**Constructie:** verticale lijn door het midden, twee diagonalen die op datzelfde midden
kruisen. `stroke-width: 4` op 147×173 — lijndikte ≈ 1:37 van de breedte. `fill: none`,
`stroke: currentColor`. De kleur komt altijd van de context, nooit uit het bestand.

In de app-header staat sinds v186 alleen het beeldmerk, wit, 26 px hoog. Het volledige
woordmerk stond daar eerst en werd rommelig naast de versiechip.

**De asterisk is ook het AI-icoon.** Elke plek waar Claude leest, sorteert of voorstelt
draagt hetzelfde teken. Als icoon: lijndikte 1.7 op een 24×24-grid.

```
<path d="M12 5v14"/><path d="M6 8l12 8"/><path d="M18 8l-12 8"/>
```

Dat is geen toeval en geen bezuiniging. Het merk *is* de AI-functie. Ze delen één vorm.
Dit is waarschijnlijk de sterkste merkbeslissing die er ligt, en de enige die ook buiten
deze app betekenis heeft.

---

## 2 · Typografie

**Outfit** (Google Fonts). De app laadt 300, 400, 500, 600, 700 — maar gebruikt er twee.

```
https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap
```

Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

### Twee gewichten

```css
--fw: 300;          /* alles */
--fw-nadruk: 500;   /* nadruk */
```

Gemeten over alle 3181 DOM-elementen op de startpagina:

| Gewicht | Elementen | Waar |
|---|---|---|
| 300 | 2962 | Alles |
| 500 | 205 | Titels, bedragen, sectiekoppen, klantnamen |
| 400 | 14 | Restje — browserdefaults op `<b>`/`<strong>`. Op te ruimen. |

Er is geen 600 en geen 700 meer in de app. Er is ook geen `<b>` die dikker is dan 500.
Nadruk komt van gewicht óf van kleur, nooit van allebei tegelijk.

De laadregel mag terug naar `wght@300;500` — dat scheelt drie fontbestanden.

### Schaal

Onder de 15 px zijn er vier maten. Daarboven is het display.

| px | Rol | Voorkomen in CSS |
|---|---|---|
| 11 | Chips, vlaggetjes, microlabels | 35× |
| 12 | Secundaire tekst, sectiekoppen, data | 101× |
| 13 | Lijstregels, standaardtekst | 98× |
| 14 | Titels van rijen, bedragen | 80× |
| 15 – 18 | Sectiekoppen, totalen | 36× |
| 22 / 30 / 56 | Alleen de dagkaart | 3× |

### Het sectiekop-gebaar

Het herkenbaarste typografische signaal in de app:

```css
font-size: 12px;
letter-spacing: 1.2px;
text-transform: uppercase;
font-weight: var(--fw-nadruk);
color: var(--mut2);   /* of de klantkleur */
```

`VOORTGANG` · `BESTELLIJST` · `OFFERTE & FACTUUR` · `WAAR LIGT DE BAL`

Dit is één regel die overal identiek is. Als het brandbook één typografisch element
overneemt, is het deze.

### Cijfers

Overal `font-variant-numeric: tabular-nums` (29×). Bedragen lijnen daardoor onder elkaar
uit. Elk euroteken staat in een eigen kolom van 9 px, elk bedrag in een kolom van 66 px,
allebei rechts uitgelijnd tot aan de rand van de scheidingslijn erboven.

---

## 3 · Kleur

Dit is het hoofdstuk dat in het oude document ontbrak, en het is het belangrijkste.

### Het vijf-statensysteem

De app kent geen "tekstkleur". Hij kent vijf *toestanden* van tekst. Alle klassieke
tokens — `--txt`, `--mut`, `--mut2`, `--ink`, `--ok`, `--primary2` — wijzen naar dezelfde
waarde. Ze zijn aliassen, geen kleuren.

| # | Token | Waarde | Betekenis |
|---|---|---|---|
| 1 | `--s1` | `#747474` | Ingetogen standaardtekst. Rust. |
| 2 | `--s2` | `#848484` | Chrome: topbalk, agenda, kalender, modals. Ook hover-tekst. |
| 3 | `--ccol` / `--scol` | klantkleur | Onthuld bij hover of bij selectie. |
| 4 | `--s4` | `#ffffff` | Welkomstscherm, actieve highlights. |
| 5 | `--si` | `#ffffff` | Ingevulde tekst in velden. |

Binnen een modal wordt `--s1` opgehoogd naar `#c0c0c0` — daar staat de gebruiker stil en
mag het lezen makkelijker zijn.

**Het idee:** de app staat standaard uit. Grijs op zwart, alles even luid. Pas als je
ergens overheen gaat of iets selecteert, springt de klantkleur aan. Kleur is dus geen
decoratie maar aandacht. Dat is een merkbeslissing, geen CSS-truc, en hij zou het
brandbook moeten dragen.

Er is **geen groen voor "klaar"**. `--ok` is grijs. Iets afronden is geen feest, het is af.
`--primary` (`#5f5f5f`) is bewust geneutraliseerd — er zat ooit blauw en paars in.

### Oppervlakken

| Token | Hex | Rol |
|---|---|---|
| `--bg` | `#0d0d0d` | Achtergrond |
| `--side` | `#151515` | Zijbalk |
| `--panel` | `#1a1a1a` | Paneel |
| `--panel2` | `#212121` | Paneel, verhoogd |
| `--line` | `#454545` | Lijnen, randen |
| `--calm` | `#404040` | Rustgrijs |

### Urgentie — de enige systeemkleuren

| Token | Hex | Betekenis |
|---|---|---|
| `--warn` | `#fbbf24` | Amber — let op |
| `--risk` | `#fb923c` | Oranje — het loopt |
| `--late` | `#f87171` | Rood — te laat |

Verlies in de financiën: `#e0726f`. Verwijderen: dezelfde rode familie.

### Klantkleuren

Elke klant krijgt één kleur, uniek binnen de app, en draagt die overal: badge, mapkop,
voortgangsbalk, vlaggetje, bedragen, rand van het geselecteerde project. Je herkent een
klant aan zijn kleur voordat je zijn naam leest.

```
#a78bfa  #60a5fa  #34d399  #fbbf24  #fb923c  #f87171
#f472b6  #22d3ee  #a3e635  #e879f9  #2dd4bf  #818cf8
#fca5a5  #4ade80  #c084fc  #38bdf8  #facc15  #fb7185
#7dd3fc  #bef264  #f0abfc  #5eead4  #94a3b8
```

Zijn de 23 op, dan genereert de app door op de HSL-cirkel: `hsl(h, 58%, 64%)` met
`h = (i × 47 + 13) mod 360`. Verzadiging en helderheid staan vast — daarom past elke
gegenereerde kleur bij het palet, en zorgt de stap van 47° dat twee opeenvolgende klanten
nooit op elkaar lijken.

**Uitzondering:** Begeister zelf is `#e8e8ea` (`BEGCOL`), bijna-wit. Privéprojecten ook.
Geen kleur betekent: geen klant.

Klantkleuren worden nooit hard geplaatst maar gemengd met de achtergrond:

```css
border-color: color-mix(in srgb, var(--ccol) 30%, transparent);
```

Gebruikte percentages, in volgorde van frequentie: **30 · 34 · 40 · 32 · 28 · 26 · 20 · 12**.
Tekst staat op 100 %, randen tussen 26 en 34, vlakken onder de 20. Die drie banden zijn
de facto het systeem, maar zijn nooit als token vastgelegd. Kandidaat voor het brandbook.

---

## 4 · Vorm

### Radius — vier tokens

```css
--r-sm: 6px;    /* chips, kleine knoppen */    33× in CSS
--r-md: 9px;    /* knoppen, velden */          60×
--r-lg: 12px;   /* panelen, kaarten */         46×
--r-pil: 999px; /* pillen, voortgangsbalk */   19×
--r: 14px;      /* grootste containers */       2×
```

Plus `50%` (27×) voor alles wat een cirkel is: avatars, dots, knoppen met één icoon.

### Lijn

1 px, in `--line` (`#454545`) of — binnen een klantcontext —
`color-mix(in srgb, var(--ccol) 28%, transparent)`.

### Hoogte

Schaduw betekent: dit ligt bovenop, dit is tijdelijk. Nooit decoratief, nooit op iets
dat in de pagina zelf staat. Drie hoogtes:

| Laag | Schaduw |
|---|---|
| Dropdown, popover | `0 6px 18px rgba(0,0,0,.55)` |
| Modal, overlay | `0 14px 34px rgba(0,0,0,.5)` – `0 24px 60px rgba(0,0,0,.55)` |
| Aan de muis (drag) | `0 28px 64px rgba(0,0,0,.55)` |

Focus is geen schaduw maar een ring: `0 0 0 2px var(--bg), 0 0 0 4px var(--mut2)`.
Twee ringen, zodat hij ook op een gekleurde rand leesbaar blijft.

---

## 5 · Iconografie

Alle iconen komen uit **Tabler Icons** (outline) of zijn in die stijl nagetekend.
24×24-grid, `fill: none`, `stroke: currentColor`, `stroke-linecap: round`,
`stroke-linejoin: round`.

Lijndikte, gemeten: **1.5** is de standaard (30×), 1.6 (21×) en 1.7 (17×) zijn de
uitzonderingen — 1.7 is de asterisk zelf, 1.6 het potlood en de prullenbak. Wat 1.8, 1.9,
2 en 2.6 doen is niet te verdedigen; dat is drift. Zet vast op 1.5, met 1.7 voor het merk.

Vaste set — de kanalen waarlangs iets binnenkomt:

| Naam | Betekenis |
|---|---|
| `asterisk` | AI. Ook het merkteken. |
| `email` | Binnengekomen per mail |
| `whatsapp` | Binnengekomen per WhatsApp |
| `phone` | Telefonische afspraak |
| `photo` | Beeld |

Daarnaast: map, prullenbak, potlood, winkelwagen, verplaatspijlen, chevron, kalender,
klok, euro, link, en de weersiconen (zon, wolk, regen, sneeuw, mist, onweer).

---

## 6 · Beweging

Terughoudend. Drie duren, één gedachte per duur.

| Duur | Waarvoor |
|---|---|
| `.12s – .15s` | Toestand: kleur, opacity, hover. Verreweg het meest (34×). |
| `.18s – .25s` | Groei: een balk die vult, een rij die inklapt. |
| `.30s – .42s` | Onthulling: overlay, prullenbak die "sure?" vrijgeeft. |

Easings: `cubic-bezier(.16,1,.3,1)` voor overlays (7×), `cubic-bezier(.22,1,.36,1)` voor
onthulling (4×), `cubic-bezier(.22,1.12,.36,1)` waar iets even mag doorschieten (2×).

Alledrie zijn varianten van dezelfde curve: snel weg, zacht aan. Niets veert terug behalve
dat ene geval.

`thinking.webp` is de enige geanimeerde asset: een lus die draait terwijl de AI leest.

---

## 7 · De dagkaart — waar het merk ademt

Eén scherm wijkt bewust af, en het is het enige scherm dat je 's ochtends als eerste ziet.

- Een **foto op de achtergrond**, dezelfde die op de landingspagina staat (Unsplash,
  portret, willekeurig per dag), donker afgedekt.
- **Bento-raster** van zes kaarten over zes kolommen, geen lijst.
- **Grote typografie**: 56 px voor het getal dat telt, 30 px voor de temperatuur, 22 px
  voor de begroeting. Allemaal in gewicht 300 — groot én dun, nooit groot én vet.
- Labels in het sectiekop-gebaar, maar met `letter-spacing: .06em` in plaats van 1.2 px.
- Wit (`#fff`) is hier de standaardtekstkleur in plaats van `--s1`. Op de foto mag het.

Dit is de enige plek waar de app iets *toont* in plaats van iets *toont waar je bij moet*.
Als het brandbook een sfeerbeeld nodig heeft, is dit het scherm.

---

## 8 · Toon

De interface spreekt Nederlands, beschrijvend of in de gebiedende wijs, nooit uitbundig.

> "Nog geen offertes, bonnen of facturen. Sleep ze de app in."

Geen uitroepteken. Geen "succesvol". Geen "even geduld". Vergissingen worden benoemd
zonder excuus: *"Lukte niet: geen leesbare tekst gevonden."* Waar de app iets vermoedt maar
niet zeker weet, zegt hij dat: *"mogelijk inspiratie"*, *"2× dezelfde link"*. Waar hij iets
vraagt, vraagt hij het één keer — en het antwoord op een onomkeerbare handeling is
letterlijk `sure?`, in de knop zelf, onthuld door de prullenbak die naar links schuift.

---

## Correcties op `BRANDBOOK-ASSETS.md`

Drie beweringen daarin waren fout. Ik heb ze destijds opgeschreven zonder te meten.

1. **"Gewicht 600 is verreweg het meest gebruikt (83×)."** Onjuist. Er stond een regel
   `*{font-weight:300!important}` die alle 138 gewichtsdeclaraties dood maakte. De app
   was toen al volledig 300. Nu is dat expliciet: twee gewichten, 300 en 500.

2. **"`--txt` is `#ececec`."** Onjuist. Die eerste `:root` werd verderop overschreven en
   niemand heeft die waarde ooit gezien. De echte standaardtekstkleur is `#747474`. Het
   hele vijf-statensysteem (hoofdstuk 3) stond nergens beschreven.

3. **"Er zijn geen schaduwen."** Onjuist. Er zijn er 37, en ze doen precies één ding:
   hoogte aangeven. Zie hoofdstuk 4.

Ook aangepast: de HSL-generator is `h = (i × 47 + 13) mod 360` (niet alleen stappen van
47°), en de radiusschaal is inmiddels vier tokens in plaats van acht losse waarden.

---

## Wat het brandbook nog moet beslissen

Eerlijk: dit is een app-palet, geen merkpalet. Wat hier ligt is intern consistent maar
nooit buiten het scherm getest.

- **Print.** Geen enkele kleur hierboven is op papier gecontroleerd. `#0d0d0d` is geen
  drukzwart en `#747474` op zwart is op papier onleesbaar.
- **Licht.** De app bestaat alleen donker. Een merk dat alleen in het donker werkt, is
  geen merk maar een thema. Wat is de lichte tegenhanger van het vijf-statensysteem?
- **Letter-spacing.** Zeventien verschillende waarden in de CSS. Er zijn er hooguit drie
  nodig: 0, `1.2px` (sectiekop), `.06em` (dagkaart-label).
- **Lijndikte iconen.** Vier waarden te veel. Voorstel: 1.5 overal, 1.7 voor de asterisk.
- **Kleurmenging.** De drie banden (tekst 100 %, rand 26–34 %, vlak <20 %) zijn echt,
  maar hebben geen naam. Geef ze er een.
- **Fotografie.** De enige beelden in de app komen willekeurig van Unsplash. Er is geen
  fotografiestijl, geen crop-regel, geen onderwerp.
- **De 400-restjes.** Veertien elementen staan nog op browserdefault. Opruimen.

De asterisk en Outfit zijn de enige twee dingen die met zekerheid *het merk* zijn en niet
*deze app*. Al het andere hierboven is een voorstel dat zich in één scherm heeft bewezen.
