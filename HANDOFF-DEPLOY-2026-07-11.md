# Deploy-handoff — klantportaal & teamkant (11 juli 2026)

Plak dit in een **nieuw Cowork-gesprek** nadat de GitHub-connector opnieuw is geautoriseerd
mét schrijfrechten op de private repo `jrncprs-create/BegeisterV3`.

## Eerste actie in het nieuwe gesprek
Test de push-connector: `get_file_contents` op `jrncprs-create/BegeisterV3` (path `package.json`).
- Werkt (geen 404) → push de 3 gewijzigde bestanden hieronder naar `main`.
- 404/geen toegang → de connector heeft nog geen private-repo-toegang; niet verder pushen.

## Wat klaarstaat (lokaal gewijzigd, gevalideerd — NIET gepusht)
Alle wijzigingen staan al in de werkmap. `node --check` op `.mjs` en `new Function()` op elk
inline `<script>` zijn schoon. Bestanden om te pushen naar `main`:
- `public/index.html`
- `public/portaal.html`
- `api/portal.mjs`

Voorgestelde commit-message:
`Klantportaal: fasebalk gelijk aan teamversie, achtergrond+letterkleur inline, voorstel-markering per Portaal-bestand, oude overlay opgeruimd`

Na de push bouwt Railway (`artistic-reprieve`) automatisch. Alleen de groene
**artistic-reprieve / portal.begeister.nl**-check telt (Vercel = dode integratie, negeren).

## Wat er inhoudelijk is veranderd
1. **Fasebalk klantkant** (`portaal.html` `.fases`) is exact gelijkgetrokken met de teamversie
   (`.pb-fase` in index.html): lijn op 30px, dot 8px met bg-ring, labels niet-uppercase met
   dezelfde spacing, naam-pil als vlaggetje boven de dot met driehoek.
2. **Klantkant-balk inline** boven het dossier (`_secKlantkant` in index.html): achtergrondkleur,
   achtergrondafbeelding (upload/wis) en letterkleur (Klantkleur/Wit/Zwart). Nieuwe functies
   `pbPortalBg`, `pbPortalImg`, `pbPortalBgImage`, `pbPortalBgClear`, `pbPortalReset`, `pbPortalTekst`.
   Letterkeuze wordt bewaard in `projects.portal_secties.tekst` (géén nieuwe DB-kolom).
   `portaal.html` past dit toe via nieuwe `themaToe(p)`; `api/portal.mjs` geeft nu ook `pg.tekst` mee.
3. **Voorstel-markering inline** per Portaal-bestand (`_portaalFileRow`, `pbToggleVoorstel`,
   `pbSetVoorstelSoort`): sterknop + Idee/Budget-segment in de Bestanden-sectie. Markeren zet
   meteen `visible_to_client` aan. Documenten dragen nu ook is_voorstel/voorstel_soort/visible_to_client.
4. **Oude overlay opgeruimd**: 297 regels weg (`#klantportaalOverlay`-CSS, `_renderPortaalBoard`,
   `toggleKlantportaal`, alle `portaal*`-functies, `.kportaal`-knop, dode vars). Behouden:
   `_KLANT_IC`, `findItemById`, `_zesMap`, `_TREE_MAPPEN`, `pbToggleClientItem`.

## Nog te doen — Task 5: Ostrica-testdata (Supabase, wacht op bevestiging)
Project `1e56842f-2d41-4c1a-b7eb-b649798115f7` ("Athene 2027"): `projectprijs=700` (stub),
`budget=40000`, fase `voorstel`.
- **Projectprijs**: juiste bedrag (€40–50k excl. btw) staat in het budget-calculatiemodel
  (Dropbox-xlsx). Bedrag nog onbekend → niet gegokt. Zodra bekend:
  `update projects set projectprijs = <BEDRAG> where id = '1e56842f-2d41-4c1a-b7eb-b649798115f7';`
- **Dubbeling**: de `documents`-rijen met `origin='file'` worden al door de app weggefilterd.
  De échte dubbeling is de v2-xlsx: files-rij `222e8c53-70f0-4204-b355-c342bc7dbb24` én los
  attachment-document `c404aaba-3bd4-448b-94c5-f9beacadd91e` (origin='attachment'). Kies welke
  blijft; om het attachment weg te gooien:
  `delete from documents where id = 'c404aaba-3bd4-448b-94c5-f9beacadd91e';`

## Context
- Repo: `jrncprs-create/BegeisterV3` (privé), branch `main`.
- De read-only GitHub-app "Claude Design Import" op GitHub is NIET de push-connector — daar niks aan doen.
- Supabase project ref: `rwevsqwvgqbzypaudzuj`. Testklant: `ostrica@begeister.nl` / `Athene`.
- Lokale git staat ~411 commits achter op origin; deploy loopt via connector-push (bestandsinhoud
  naar main), niet via lokale git. Niet blind `git push`.
