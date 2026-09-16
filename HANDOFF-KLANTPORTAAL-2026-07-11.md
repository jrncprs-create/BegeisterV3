# Handoff — Klantportaal & teamkant (11 juli 2026)

Plak dit blok in een **nieuw Cowork-gesprek**. Eerste actie daar: **test de GitHub-connector op BegeisterV3** (`get_file_contents`); werkt die, push dan voortaan rechtstreeks via de connector (geen Chrome/web-editor meer nodig).

## Basis
- Repo: `jrncprs-create/BegeisterV3` (privé), branch `main`. Lokale map is gekoppeld.
- Deploy: **Railway** dienst `artistic-reprieve`, project-id `27b6aae8-8811-4ffc-9e0b-038f29edd0dd` (env `production`). Bouwt automatisch op elke push naar `main`.
- Supabase project ref: `rwevsqwvgqbzypaudzuj`.
- Testklant: `ostrica@begeister.nl` / `Athene`. Ostrica project-id: `1e56842f-2d41-4c1a-b7eb-b649798115f7`.
- Vercel-checks in GitHub zijn een dode integratie (rood = negeren). Alleen de groene **artistic-reprieve / portal.begeister.nl** telt.

## Deploy-mechaniek (belangrijk)
- De GitHub-**connector** in de huidige sessie zag de privé-repo niet (404). Er is opnieuw gekoppeld met repo-toegang, maar dat laadt pas in een **nieuw gesprek**. Test dus eerst.
- `index.html` is ~780 KB — te groot voor de web-editor-plaktruc. Met een werkende connector gewoon rechtstreeks pushen.

## Al LIVE (vandaag gedeployed op main)
1. **`public/portaal.html`** volledig herbouwd in de pic1-stijl: near-black `#0d0d0d`, alles getint in klantkleur (`--scol`), uppercase sectiekoppen, fasebalk met naam-pil, `.pb`-achtige rijen. Maroon-achtergrond en achtergrondfoto-waas eruit. Bestanden = platte lijst (geen mappenboom). Voorstellen + akkoord op idee/budget behouden, herstijld. Voorstel-viewer (fullscreen iframe) behouden.
2. **`api/portal.mjs`**:
   - Bestanden voor de klant = uitsluitend de map **Portaal** (`_mapVan(f) === "Portaal"`), platte lijst.
   - Voorstellen los: `is_voorstel && visible_to_client`.
   - **Publiceer-drempel verwijderd** (`portal_gepubliceerd`-filter eruit): de poppetjes (per item) + map Portaal zijn de enige zichtbaarheidsschakelaars. Klant ziet z'n eigen niet-gearchiveerde projecten, en daarbinnen precies wat zichtbaar is gezet.
   - **`_zesMap` Portaal-fix**: regel `if (c === "portaal") return "Portaal";` toegevoegd (ontbrak in de API t.o.v. index.html) — zonder deze belandden Portaal-bestanden onder "Concept & ontwerp" en verschenen ze nooit bij de klant.
3. **`public/index.html` — teamkant poppetjes**: zichtbaarheid-poppetje inline naast het potloodje bij `taskRow`, `waitRow`, `doneRow`, `apptRow` en bij de koppen **Omschrijving** en **Voortgang**. Nieuwe helper `_pbKz(soort,id,aan)` in `_renderProjBoard`, nieuwe functie `pbToggleClientItem(soort,id)` (bewaart `client_zichtbaar` op items/appointments en `portal_secties` op het project), en CSS-blok `.pb-kz`. Dof = verborgen, vol = zichtbaar voor de klant.

## NOG TE DOEN
1. **Fasebalk klantkant gelijktrekken** met de teamversie (`.pb-fase` in index.html). Nu wijkt de opmaak op portaal.html iets af (padding/lijnpositie/pil). Doel: identiek ogen.
2. **Teamkant: achtergrond + witte/zwarte letters kiezen** per klantproject voor de klantkant. Zat in de oude overlay (`portaalAchtergrond`, `portaalUploadBg`, `portal_bg`, `portal_bg_image`); moet nu inline op het projectbord (kleine balk boven het dossier). portaal.html moet die achtergrond + tekstkleur dan toepassen (nu forceert het near-black + klantkleur).
3. **Voorstel-markering (idee/budget) per Portaal-bestand** inline in de Bestanden-sectie van het projectbord (was `portaalVoorstelSoort` in de overlay).
4. **Oude overlay opruimen**: `#klantportaalOverlay`, `_renderPortaalBoard`, `toggleKlantportaal` en de open-knoppen `.kportaal` verwijderen — pas nadat 2 en 3 inline staan (anders verdwijnen publiceren/achtergrond/voorstel-markering).
5. **Ostrica-testdata**: `projectprijs = 700` terwijl project €40–50k is (vertekent marge). Budget-calculatiemodel staat dubbel (in `files` én `documents`). Opruimen/corrigeren.

## Handige codeplekken (index.html)
- `_renderProjBoard()` ~regel 4406: bouwt het projectbord. Rij-builders en `_pbKz` staan hier; layout-assemblage rond regel 4503–4506.
- `_omsSectie(p)` ~4637: Omschrijving-kop (poppetje `kzOms` toegevoegd).
- Oude overlay: `toggleKlantportaal` ~4146, `_renderPortaalBoard` ~4306, overlay-CSS `#klantportaalOverlay` ~640.
- `_zesMap`/`_TREE_MAPPEN` ~4272–4287 (Portaal-map = categorie/icon `portaal`).

## Werkwijze-afspraken
- Lokaal wijzigen in de gekoppelde map, valideren: `node --check` op `.mjs` en `new Function()` op elk inline `<script>` in HTML.
- Deployen via push naar `main` → Railway bouwt automatisch.
- Side-effects (data-mutaties, publiceren) eerst bevestigen.
