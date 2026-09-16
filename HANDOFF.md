# Begeister Workflow — Handoff

_Laatst bijgewerkt: 11 juli 2026 · live versie **v232**_

Dit document is de overdracht voor wie verder bouwt aan de Begeister-workflow-app. Het beschrijft
de bedoeling, de architectuur, hoe we werken/deployen, wat er staat, wat nog niet goed genoeg is,
en wat de volgende stappen zijn.

---

## 1. Wat is het (de bedoeling)

Een interne **workflow-/projectapp voor Begeister** (licht, decor, events). Eén plek waar:

- alles wat binnenkomt (mail via **intake@begeister.nl**, WhatsApp, binnengesleepte bestanden, geplakte tekst) automatisch met AI wordt gelezen, samengevat en aan de juiste **klant + project** wordt gekoppeld;
- per project een **dossier** ontstaat: omschrijving, voortgang (fases), taken, afspraken, bestanden, financiën;
- er een **klantportaal** (portal.begeister.nl) is waar de klant read-only een geselecteerd deel van het dossier ziet, voorstellen bekijkt en akkoord geeft.

Kernprincipe: **AI-first intake** — de gebruiker hoeft niks te sorteren; de app stelt voor en de mens bevestigt.

Jeroen is ontwerper, geen developer. Hij test in de praktijk en stuurt bij; de bouw gebeurt hier.

---

## 2. Architectuur & stack

- **Frontend:** één groot vanilla-JS bestand `public/index.html` (~760 KB, géén build-step). Alles zit in twee `<script>`-blokken. Aparte `public/portaal.html` voor het klantportaal. Service worker `public/sw.js` (network-first).
- **Backend:** Node/Express `server.mjs` op **Railway**, plus Vercel-stijl handlers in `api/*.mjs` (elk `export default (req,res)`), gemount in server.mjs. Host-based routing: `portal.begeister.nl` → portaal.html, anders index.html.
- **Database/auth/storage:** **Supabase** (project ref `rwevsqwvgqbzypaudzuj`). Postgres + Auth + Storage. Buckets: `intake` (privé, mailbijlagen) en `shared` (publiek, o.a. portaal-achtergronden).
- **AI:** Anthropic (Claude Haiku voor intake/sortering, o.a. in `intake/extract.mjs`, `api/readdrop.mjs`, `api/sortfiles.mjs`).
- **Dropbox:** bestanden worden naar Dropbox gesynct (`lib/dropboxsync.mjs`, `api/dropbox/*`). Mappenpad = `/Klant/Project/Categorie`.
- **Intake-poller:** interne cron in server.mjs draait elke 2 min `intake/poller.mjs` (mailbox → sources → items). Dropbox-sync elk uur.

### Domeinen (cloud86 DNS → Railway)
- `app.begeister.nl` → CNAME `kr7ll4n4.up.railway.app`
- `portal.begeister.nl` → CNAME `3p63u96c.up.railway.app` (+ TXT verify)

---

## 3. Werkwijze (hoe we ontwikkelen & deployen)

**Regels die we aanhouden:**
1. Wijzig lokaal in `/Users/jeroencuypers/Projects/BegeisterV3`.
2. **Valideren vóór deploy:** elk `<script>`-blok in HTML met `new Function()`, en `node --check` op elke `.mjs`.
3. **Versiechip ophogen** bij elke index.html-deploy: `<span class="ver-chip">vNNN</span>` (nu v232). Zo zie je in de app of je deploy live is.
4. **Deployen via GitHub web-upload** (repo `jrncprs-create/BegeisterV3`, branch `main`): ga naar `github.com/.../upload/main/<map>`, upload het bestand, commit. Railway bouwt automatisch.
5. **Side-effects bevestigen** met Jeroen vóór uitvoeren (DNS, domeinen, data-mutaties).

**Deploy-eigenaardigheden (belangrijk!):**
- De "Commit changes"-knop verschuift als het commit-bericht **>50 tekens** is (GitHub toont dan een ProTip die de knop omlaag duwt). Hou berichten kort óf screenshot vóór je klikt.
- Klikken op de commit-knop lukt soms niet als je het commit-berichtveld niet eerst goed hebt gefocust — **scroll eerst, klik dan het veld, typ, en klik commit**. Verifieer daarna dat de map-rij de nieuwe commit toont (anders opnieuw).
- Elke map wordt apart geüpload/gecommit (public, api, intake, lib, sql…).

**Testomgeving:** dummy-klantlogin `ostrica@begeister.nl` / `Athene` om het klantportaal te testen. Team = Jeroen & Marlon.

---

## 4. Datamodel (belangrijkste tabellen)

- **clients** — klant met `id`, `name`, `color`, `kind`. (Hernoemen gebeurt hier, cascade.)
- **projects** — project per klant. Relevante kolommen: `phase` (briefing/voorstel/productie/oplevering/betaald), `projectprijs`, `btw`, `budget`, `description`, `notes`, `portal_secties` (jsonb: welke secties de klant ziet), `portal_gepubliceerd`, `portal_bg` (kleur), `portal_bg_image` (URL), `idee_akkoord_op`, `budget_akkoord_op`.
- **items** — taken. `status` (todo/doing/wait/done), `source_id`, `client_zichtbaar`, en **`checklist`** (jsonb array `[{t,done}]`) voor gegroepeerde subpunten.
- **sources** — inkomende berichten (mail/whatsapp/drop/paste) + AI-suggesties (`suggest_*`, `triage`).
- **files** — Dropbox-bestanden. `owner_type`(project/task/client) + `owner_id`, `icon` (= categorie), `visible_to_client`, `is_voorstel`, `voorstel_soort`(idee/budget).
- **documents** — mailbijlagen (Storage). `category`, `visible_to_client`, `is_voorstel`, `voorstel_soort`, `origin` (attachment/file). **Let op:** de meeste projectbestanden staan hier, niet in `files`.
- **appointments, comments, approvals, project_board (inkoop), contacts, folders, insp_items.**

**Dubbele-bron-valkuil:** een bestand kan zowel in `files` (owner_type project) als in `documents` (origin=`file`) staan. De frontend voegt beide samen in `state.files` (docFiles), waarbij `origin='file'` wordt overgeslagen om dubbels te vermijden. Het klantportaal (`api/portal.mjs`) leest sinds v232 **beide** tabellen.

**Mappenstructuur (zes vaste mappen + Portaal):** Briefing · Concept & ontwerp · Techniek · Beeld · Financieel · Oplevering · **Portaal**. Dit is een **weergavelaag** (`_zesMap`/`_TREE_MAPPEN`) bovenop de ruwe categorie. De AI-intake sorteert nieuw materiaal in deze mappen; "Portaal" vult het team zelf.

---

## 5. Beveiliging (RLS)

- Tabel **team_users** + security-definer functie **is_team()**. Alle app-tabellen staan op policy `using(is_team())` → alleen team (Jeroen/Marlon) mag direct bij de data.
- **client_users** koppelt een Supabase auth-user aan een `clients`-rij. De klant praat **nooit** direct met tabellen — alleen via `/api/portal` (service-role), dat de klant uit het bearer-token afleidt. `/api/portalbeheer` is de teamkant (403 voor niet-team).
- Wat de klant ziet is **default uit**; het team zet per item (of per map) `visible_to_client` / `client_zichtbaar` aan.

---

## 6. Wat er staat (v232)

**Intake & taken**
- AI-first drop/mail-intake met samenvatting + actiepunten; herkent bestaande klant/project (biedt geen dubbel project meer aan).
- **Groepering:** één bron met meerdere actiepunten = **één taakkaart met afvinkbare subpunten** (checklist), i.p.v. een muur van kaartjes. Afvinken op de kaart én in de taak; subpunten toevoegen/verwijderen.
- HTML-bestanden worden gelezen (tags gestript); JS-gerenderde decks worden herkend op naam i.p.v. "onleesbaar".
- Drop-kaart: keuze **"alleen bestand"** (opslaan zonder actiepunten); leesanimatie = ademende asterisk met status-tekst; faal-tak laat alsnog handmatig kiezen.

**Bestanden**
- Zes vaste mappen + Portaal, altijd zichtbaar per **klantproject** (niet bij Begeister/Privé). Boom + projectbord + Dropbox gebruiken dezelfde indeling. HTML/PDF-preview via `api/fileproxy.mjs` (forceert juiste content-type). Snappy drag-drop (optimistisch).

**Klantportaal**
- Overlay vanuit de app (schuift van boven in) = teamkant: per item een klant-icoontje (aan/uit), **map-brede** zichtbaarheidsknop, publiceren, achtergrondkleur (default = verdonkerde klantkleur) + eigen achtergrondafbeelding uploaden. "Gepubliceerd ✓" springt terug naar "Wijzigingen publiceren" bij een wijziging.
- Voorstellen per **Idee/Budget** met twee poorten (akkoord per spoor); beide groen → fase productie.
- Klantkant (portal.begeister.nl): read-only dossier, previews **fullscreen** in afgeschermde iframe (met kruisje), opmerkingen per sectie, akkoord per poort. Geen rode flits meer bij laden.

---

## 7. Wat nog niet lekker werkt / known issues

1. **Financiën vs. de zes mappen (ACTIEF — hier ging het net mis).**
   De Financiën-pagina rekent met de categorieën **Offertes / Inkoop / Facturen** (`_finMapVan`). De zes-mappen-sortering heeft financiële bestanden juist op categorie **"Financieel"** gezet. Gevolg: `_finMapVan` herkent "Financieel" niet, en namen als *budget-calculatiemodel* / *kostenraming* vallen buiten de offerte/factuur/inkoop-detectie → die documenten verschijnen **niet** in de Financiën-uitsplitsing. Twee sporen bijten elkaar.
   - **Bedoeling:** Financiën en de Bestanden-mappen moeten samenwerken. Voorstel: laat `_finMapVan` ook categorie "Financieel" accepteren en op naam onderscheiden (offerte/factuur/inkoop/budget), of houd Offertes/Inkoop/Facturen als sub-indeling ónder de map "Financieel". Kies één bron van waarheid.
   - Bijkomend bij Ostrica: `projectprijs = 700` terwijl het project €40–50k is (waarschijnlijk een test-/scanwaarde) → vertekent verkoop/marge. En het budget-calculatiemodel (xlsx) staat **dubbel** (in `files` én `documents`).

2. **Losse oude items niet gegroepeerd.** De checklist-groepering geldt voor **nieuwe** binnenkomst. Bestaande losse Ostrica-kaartjes (budget-model x3) blijven los tot ze opnieuw worden aangemaakt/opgeruimd.

3. **Zichtbaarheid default uit.** De klant ziet niets tot het team bestanden zichtbaar zet. Dat is bewust (privacy), maar vraagt handwerk — de map-brede knop verzacht dit.

4. **Weesbestanden.** Bestanden konden aan een niet-bestaande taak hangen (gedicht in v227: drop hangt nu aan het project). Eén losse wees blijft: `houten-planken-textuur.jpg` (geen project).

5. **Backup-tabellen** `_contacts_backup_*`, `_postvak_backup_*` staan op RLS-on-zonder-policy (dus dicht) — opruimen mag.

6. **Deploy-fragiliteit.** Handmatige GitHub-upload is foutgevoelig (commit-knop, >50-tekens-ProTip). Overweeg een echte git-push of GitHub API-flow.

---

## 8. Wat de bedoeling is (volgende stappen)

- **Financiën & mappen verzoenen** (issue 1) — hoogste prioriteit; dit is wat "raar" doet.
- **Opmerkingen op locaties**: de klant een opmerking laten pinnen op een specifieke plek/pagina van een voorstel (comment-pins over het deck/iframe). Door Jeroen gevraagd.
- **HTML-voorstel pagina-voor-pagina**: deck slide-voor-slide tonen met opmerking + akkoord per pagina (nu opent het deck als geheel).
- **Bestaande items opnieuw groeperen** (optioneel migratiescript naar checklist).
- **Deploy verbeteren** (git-push i.p.v. web-upload).

---

## 9. Handige verwijzingen

- **Repo:** `github.com/jrncprs-create/BegeisterV3` (branch `main`). Mappen: `public/` (frontend), `api/` (handlers), `intake/` (poller+extract), `lib/` (dropboxsync e.d.), `sql/` (migraties/rollback), `server.mjs`.
- **Supabase project:** `rwevsqwvgqbzypaudzuj`.
- **Railway service:** `artistic-reprieve / production` (de groene; oude "Production – begeister(-app)" zijn dood, negeren).
- **Testklant:** `ostrica@begeister.nl` / `Athene`. Ostrica-project-id: `1e56842f-2d41-4c1a-b7eb-b649798115f7`.
- **Versie ophogen** in `public/index.html` bij elke deploy; valideren met `new Function()` + `node --check`.
