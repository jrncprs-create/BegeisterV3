# Begeister — UI-standaard (huisstijl-sheet)

Vaste ontwerpregels voor de app (`public/index.html`) en het klantportaal (`public/portaal.html`).
Deze sheet is leidend: pas 'm altijd toe, zodat we niet elke keer opnieuw hoeven te discussiëren.

## 1. Klantkleur op alles

Elk venster, elke kaart en elk dossierblok neemt het **accent van de klant** waar het bij hoort.

- De klantkleur zit in CSS-variabelen: `--scol` (dossier/portaal), `--ccol` (klantenlijst), `--kk` (accord-kaart).
- Wat kleurt mee: sectiekoppen, vinkjes/lampjes, pillen/knoppen (primair), fasebalk + ballonnetje, badges, actieve project-markering.
- **Nooit** een vaste kleur hardcoden op een plek waar een klantkleur hoort.
- **Fallback** als een klant geen kleur heeft, of een kleur die te donker is op de zwarte achtergrond (luminantie < 60): rustige goudtint `#cbb26a`.
- Bepalen: pak de kleur van een project van die klant (`projects.color`); valideer op geldige hex + leesbaarheid; anders fallback.

## 2. Dropdowns met klantnamen = zwarte achtergrond

Elke dropdown die gekleurde klantnamen toont heeft een **zwarte** achtergrond (`#000`), dunne lichte rand.

- Klantnamen in hun eigen kleur, met het badge-vierkantje ervoor.
- Geldt voor het menu-laatje (`#kMenu`) én de verrijkte selects (`.cdd-menu`, via `_enhanceSelect`).
- Menubalk zelf en alle overlays: ook zwart (`--bg`), net als de rest.

## 3. Picto's boven pillen — rust en eenvoud

- Voorkeur voor **picto's** in plaats van pillen-met-tekst.
- **Eén picto per regel.** Nooit dubbel (bv. een selectievinkje én een soort-pil naast elkaar die hetzelfde lijken te zeggen).
- Groeperen op soort met een kopje + streepje (bv. "Taken" / "Feiten") in plaats van een pil per regel.
- Ruime regelafstand, dunne scheidingslijntjes, laat tekst ademen.

## 4. Vaste picto-conventies

- **Verwijderen** = vuilnisbakje, nooit een kruisje.
- **Aan/uit vinken** = outline afgerond vierkantje dat een vinkje krijgt als het actief is (aan = klantkleur, uit = grijs, leeg).
- **Feit** = lampje (aan = klantkleur, uit = grijs).
- **Chevrons** = alleen omhoog (dicht) of omlaag (open). **Nooit naar rechts.**

## 5. Popups

- Witte tekst op een **blurred, donkere** achtergrond (`.overlay.uip`).
- Sluiten met een kruisje rechtsboven; primaire actie in klantkleur waar van toepassing.

## 6. Tekstweergave

- Regeleinden respecteren in de weergave (`white-space: pre-wrap`) — lijstjes tonen één regel per item, niet één doorlopende alinea.
- Lange URL's netjes afbreken (`overflow-wrap: anywhere`).

## 7. Deployen

- Versiechip (`.ver-chip`) +1 bij elke deploy.
- Kleine tekstbestanden via de GitHub-connector; `index.html` via de upload-pagina.
- Railway SUCCESS afwachten, daarna live verifiëren met een verse `?v=`.
