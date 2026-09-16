# Begeister — designassets in gebruik

Inventarisatie van alles wat de Begeister-app op dit moment daadwerkelijk gebruikt.
Peildatum 10 juli 2026, app-versie v193. Bedoeld als grondstof voor het brandbook:
dit is wat er *is*, niet wat het zou moeten worden.

---

## 1. Beeldmerk en woordmerk

Het merk is één vorm: een asterisk van drie lijnen. Geen vullingen, geen bocht — drie
rechte lijnen die elkaar in één punt kruisen. Het woordmerk is diezelfde asterisk met
"Begeister" ernaast in outline-letters.

| Bestand | Wat het is | Formaat | Gebruik |
|---|---|---|---|
| `begeister-symbol.svg` | Beeldmerk, los | SVG, viewBox `0 0 147.39 172.8` | Standalone merkteken |
| `begeister-logo.svg` | Woordmerk incl. asterisk | SVG, viewBox `0 0 294.78 55.06` | Volledig logo |
| `icon-512.png` | App-icoon | 512×512 PNG | PWA, installatie |
| `icon-192.png` | App-icoon | 192×192 PNG | PWA, Android |
| `apple-touch-icon.png` | App-icoon | PNG | iOS-beginscherm |
| `favicon-32.png` | Favicon | 32×32 PNG | Browsertab |

**Constructie van de asterisk** (uit `begeister-symbol.svg`):

- Verticale lijn van boven naar onder door het midden
- Twee diagonalen die elkaar op datzelfde midden kruisen
- `stroke-width: 4` op een canvas van 147×173 — dus ongeveer 1:37 lijndikte t.o.v. breedte
- `fill: none`, `stroke: currentColor` — de kleur komt altijd van de context

In de app-header staat sinds v186 alleen het beeldmerk, in wit, op 26 px hoog. Het
volledige woordmerk stond daar eerst, maar dat werd rommelig naast de versiechip en de
verbruiksteller.

De asterisk keert terug als **AI-icoon**: elke plek waar Claude iets leest, sorteert of
voorstelt, draagt hetzelfde teken. Als icoon is de lijndikte 1.7 op een 24×24-grid:

```
<path d="M12 5v14"/><path d="M6 8l12 8"/><path d="M18 8l-12 8"/>
```

Dat is bewust: het merk *is* de AI-functie. Ze delen één vorm.

---

## 2. Typografie

**Outfit** (Google Fonts), gewichten 300, 400, 500, 600, 700.

```
https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap
```

Fallbackstapel: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

**Gewichten zoals daadwerkelijk gebruikt**

| Gewicht | Waarvoor |
|---|---|
| 300 | Zeldzaam; grote, rustige cijfers |
| 400 | Lopende tekst, secundaire labels |
| 500 | Lichte nadruk |
| 600 | Standaard nadruk — verreweg het meest gebruikt (83×) |
| 700 | Bedragen, koppen, badges |

**Schaal** — de app is compact. De meest gebruikte maten:

| px | Rol |
|---|---|
| 10.5 – 11 | Chips, vlaggetjes, microlabels |
| 11.5 – 12 | Secundaire tekst, redenen, data |
| 12.5 – 13 | Lijstregels, standaardtekst |
| 13.5 – 14 | Titels van rijen, bedragen |
| 15 – 17 | Sectiekoppen, totalen |
| 19+ | Cijfers die er echt toe doen |

**Sectiekoppen** krijgen `letter-spacing: 1.2px`, `text-transform: uppercase`,
`font-size: 11px`, in `--mut2` of de klantkleur. Dat is het herkenbaarste
typografische gebaar in de app: `VOORTGANG`, `BESTELLIJST`, `OFFERTE & FACTUUR`.

**Cijfers** staan altijd in `font-variant-numeric: tabular-nums`, zodat bedragen onder
elkaar uitlijnen. Elk euroteken heeft een vaste kolom van 9 px, elk bedrag een vaste
kolom van 66 px.

---

## 3. Kleur

De app is donker en bewust monochroom. Kleur betekent iets: hij hoort bij een klant, of
hij waarschuwt. Er is geen decoratieve kleur.

### Grijstrap (de basis)

| Token | Hex | Rol |
|---|---|---|
| `--bg` | `#0d0d0d` | Achtergrond |
| `--side` | `#151515` | Zijbalk |
| `--panel` | `#1a1a1a` | Paneel |
| `--panel2` | `#212121` | Paneel, verhoogd |
| `--line` | `#454545` | Lijnen, randen |
| `--txt` | `#ececec` | Tekst |
| `--mut` | `#9b9b9b` | Gedempte tekst |
| `--mut2` | `#6a6a6a` | Hints, microlabels |
| `--calm` | `#404040` | Rustgrijs |
| `--ink` | `#ffffff` | Actieve witte tekst |

Let op: er is géén groen voor "klaar". `--ok` is `#e6e6e6` — neutraal wit. Iets afronden
is geen feest, het is gewoon af. Ook `--primary` is geneutraliseerd naar grijs: er zat
ooit blauw en paars in, dat is er bewust uit gehaald.

### Urgentie (de enige systeemkleuren)

| Token | Hex | Betekenis |
|---|---|---|
| `--warn` | `#fbbf24` | Amber — let op |
| `--risk` | `#fb923c` | Oranje — het loopt |
| `--late` | `#f87171` | Rood — te laat |

Verlies in de financiën gebruikt `#e0726f`; verwijderen gebruikt dezelfde rode familie.

### Klantkleuren

Elke klant krijgt één kleur, uniek binnen de app. Die kleur is daarna overal terug te
zien: de badge, de mapkoppen, de voortgangsbalk, het vlaggetje, de bedragen, de rand
van het geselecteerde project. Een klant herken je aan zijn kleur voordat je zijn naam
leest.

Het palet (`PALETTE`, 23 kleuren, in volgorde van toewijzing):

```
#a78bfa  #60a5fa  #34d399  #fbbf24  #fb923c  #f87171
#f472b6  #22d3ee  #a3e635  #e879f9  #2dd4bf  #818cf8
#fca5a5  #4ade80  #c084fc  #38bdf8  #facc15  #fb7185
#7dd3fc  #bef264  #f0abfc  #5eead4  #94a3b8
```

Zijn ze op, dan genereert de app nieuwe kleuren op de HSL-cirkel: `hsl(h, 58%, 64%)`,
in stappen van 47° zodat opeenvolgende klanten nooit op elkaar lijken. Verzadiging 58 %
en helderheid 64 % zijn vast — daarom past elke gegenereerde kleur bij het palet.

**Uitzondering:** interne projecten (Begeister) en privéprojecten krijgen `#e8e8ea` —
wit-grijs. Geen kleur betekent: geen klant.

In de app worden deze kleuren nooit hard geplaatst maar via `color-mix()` gemengd met de
achtergrond, zodat een randje van een klantkleur op 25–35 % staat en de tekst op 100 %.

---

## 4. Vorm

| Element | Radius |
|---|---|
| Kleine knoppen, chips | 5 – 7 px |
| Standaardknop, veld | 8 – 10 px |
| Paneel, kaart | 11 – 12 px |
| Pil, voortgangsbalk | 999 px |

`--r: 14px` is de globale radius voor de grootste containers.

Lijnen zijn 1 px, in `--line` (`#454545`) of — binnen een klantcontext —
`color-mix(in srgb, var(--klantkleur) 28%, transparent)`.

Er zijn **geen schaduwen** in de interface, met één uitzondering: de zwevende
productafbeelding aan de muis (`0 10px 30px rgba(0,0,0,.55)`).

---

## 5. Iconografie

Alle iconen komen uit **Tabler Icons** (outline), of zijn in die stijl nagetekend.
Kenmerken: 24×24-grid, `fill: none`, `stroke: currentColor`, `stroke-width` 1.4 – 1.7,
`stroke-linecap: round`, `stroke-linejoin: round`.

Vaste set in `_TABCHAN` — de kanalen waarlangs iets binnenkomt:

| Naam | Betekenis |
|---|---|
| `asterisk` | AI — lezen, sorteren, voorstellen. Ook het merkteken. |
| `email` | Binnengekomen per mail |
| `whatsapp` | Binnengekomen per WhatsApp |
| `phone` | Telefonische afspraak |
| `photo` | Beeld |

Daarnaast in gebruik: map, prullenbak, potlood, winkelwagen, verplaatspijlen, chevron,
kalender, klok, euro, link.

---

## 6. Beweging

Terughoudend. Drie soorten:

- **Toestand** — `transition: opacity .15s` op knoppen die bij hover verschijnen
- **Groei** — `transition: width .25s ease` op de voortgangsbalk, `height .42s ease` op rijen die verdwijnen
- **Overlay** — `opacity .35s ease` bij openen, `.42s` bij sluiten

`thinking.webp` is de enige geanimeerde asset: een lus die draait terwijl de AI leest.

---

## 7. Toon

Niet strikt een asset, maar wel een merkbeslissing die overal doorwerkt.

De interface spreekt Nederlands, in de gebiedende wijs of gewoon beschrijvend, nooit
uitbundig. "Nog geen offertes, bonnen of facturen. Sleep ze de app in." Geen uitroepteken,
geen "succesvol", geen "even geduld". Vergissingen worden benoemd zonder excuus:
"Lukte niet: geen leesbare tekst gevonden."

Waar de app iets weet maar niet zeker is, zegt hij dat: "mogelijk inspiratie",
"2× dezelfde link". Waar hij iets vraagt, vraagt hij het één keer.

---

## Wat er (nog) niet is

Eerlijk voor het brandbook: dit is een app-palet, geen merkpalet. Er is geen
gedefinieerde print-kleur, geen secundair lettertype, geen fotografiestijl, geen
illustratieregels, geen tone-of-voice-document buiten de interface om. De asterisk en
Outfit zijn de enige twee dingen die met zekerheid *het merk* zijn en niet *deze app*.
