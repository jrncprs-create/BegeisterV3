# Begeister — Overdracht & Logboek

> Volledige context zodat een **nieuw gesprek** direct en vlekkeloos verder kan.
> Laatst bijgewerkt: 28 juni 2026.

---

## 1. Wat is Begeister

Een gedeelde AI-werkplek (PWA) voor **Jeroen** en **Marlon** — hun bedrijf doet licht,
decor en event-productie.

- **Jeroen** = ontwerper / vormgever.
- **Marlon** = event manager. Marlon is een **vrouw** → gebruik **zij / haar**.
- Mappen/taken zijn **nooit van één persoon**: ze zijn altijd van Marlon én Jeroen samen
  (behalve waar expliciet een eigenaar-toggle staat, zie §6).

De hele frontend zit in **één bestand**: `public/index.html` (HTML + CSS + vanilla JS,
geen build-stap, geen framework). Bewust zo gehouden.

---

## 2. Architectuur in het kort

| Laag | Wat |
|---|---|
| Frontend | `public/index.html` — alles: views, modals, drag/drop, animaties, dropdowns |
| Server | `server.mjs` — Express; serveert `public/` statisch + mount alle `api/*.mjs` als routes + draait de intake-cron intern (node-cron, elke 2 min) |
| API-handlers | `api/*.mjs` en `api/dropbox/*.mjs` — Vercel-stijl `export default (req,res)` |
| Database | **Supabase** (Postgres + Storage + RLS). Project ref `rwevsqwvgqbzypaudzuj`. Client gebruikt publishable key; servers gebruiken service-role key |
| AI | Anthropic SDK. `claude-sonnet-4-6` voor extract/organize, `claude-haiku-4-5-20251001` voor spark/sortfiles |
| Push | web-push (VAPID) |
| Bestandsopslag | **Dropbox** (gedeelde links). Root = `/Begeister` |

---

## 2b. Invoerkanalen (alle manieren waarop input binnenkomt)

> Volledige lijst van hoe input de app in komt — voor overdracht naar een ander gesprek.

**Automatisch tot actiepunten verwerkt (via Claude-extractie):**

1. **E-mail** → `intake@begeister.nl` (IMAP, elke paar min; origineel woord-voor-woord bewaard). `sources.channel = 'email'` (`intake/poller.mjs`).
2. **WhatsApp** → Cloud API webhook. `sources.channel = 'whatsapp'` (`intake/whatsapp.mjs`).
   - **Status:** keten werkt, maar draait nog op Meta's **testnummer** (+1 555 672-8022). Een **echt, eigen telefoonnummer** is nog niet geregistreerd (Step 2 "Production setup" → "Register your WhatsApp phone number" staat open). Business-verificatie ("Cprs") is wél door (Verified, 28 jun 2026) en de webhook is geconfigureerd. Media (foto/doc/voice) wordt nu nog als placeholder-tekst opgeslagen, niet gedownload/getranscribeerd.
3. **In-app chat** → typen, **plakken**, of **inspreken** (mic → transcriptie). `sources.channel = 'chat'` (`api/chat.mjs`).
4. **Foto's in de chat** → vision: foto wordt samengevat + actiepunten voorgesteld (`api/vision.mjs`).

**Bestanden:**

5. **Bijlage toevoegen in de chat** (bijlage-knop) → upload naar Dropbox + gekoppeld.
6. **Bestanden slepen in de Files-view** (desktop) → Dropbox (drag-to-upload).
7. **Bestaande Dropbox-bestanden koppelen** (linken vanuit de app).

**Handmatig (zonder AI):**

8. **+ knoppen** → zelf een wacht-item, taak of afspraak aanmaken.

---

## 3. Deploy-werkwijze (BELANGRIJK — actueel)

> ⚠️ De oude flow (Vercel, "Jeroen pusht zelf") is **vervangen**. Nu:

- **Hosting = Railway.** Push naar `main` → Railway bouwt en deployt automatisch.
- **Git-repo lokaal voor deploy: `/tmp/bg`** (heeft de PAT-remote ingesteld).
- Workflow vanuit een sessie:
  1. Bewerk in de workspace: `/Users/jeroencuypers/Projects/BegeisterV3/...`
     (in de Linux-sandbox is dat `/sessions/<id>/mnt/BegeisterV3/...`).
  2. Kopieer gewijzigde bestanden naar `/tmp/bg`.
  3. `git -c user.email=jrncprs@gmail.com -c user.name=Jeroen commit -m "..."`
  4. `git push origin main` → Railway deployt.
- Repo: **`jrncprs-create/BegeisterV3`**. Commit-auteur: `jrncprs@gmail.com`.
- **Statische wijzigingen** (`public/index.html`) zijn snel live.
- **Server-wijzigingen** (`server.mjs`, `api/*.mjs`) vereisen een server-restart →
  reken op ~60–90s na de push voordat het echt draait.

Voorbeeld-commando dat werkt:
```bash
cd /tmp/bg && cp <workspace>/public/index.html public/index.html && \
git add -A && git -c user.email=jrncprs@gmail.com -c user.name=Jeroen \
commit -q -m "..." && git push -q origin main
```

---

## 4. Datamodel (Supabase)

- **tasks** — taken (status `wait` = In afwachting, anders Taken). Eigenaar-veld voor
  Jeroen/Marlon. Volgorde In-afwachting in kolom; Taken-volgorde in localStorage `task_ord`.
- **appointments** — afspraken (sql in `sql/appointments.sql`, al aangemaakt). AI plant via chat.
- **clients** — klanten, elk met een **kleur** (badge). Kleur wordt overal gebruikt
  (dropdowns, mappen, bron-pills).
- **projects** — projecten, horen bij een klant. Klanten zónder project verschijnen niet
  in de project-dropdown.
- **contacts** — AI-geëxtraheerd uit bronnen.
- **files** — gekoppelde bestanden. Kolommen:
  `id, owner_type ('project'|'task'|'client'), owner_id, name, link (Dropbox shared URL),
  icon, created_at`.
  - **Let op:** de kolom **`icon` is herbestemd** als de **AI-categorie/mapnaam**
    (bv. "Lichtontwerp", "Facturen"). Er was géén migratie nodig. `icon` leeg = "Niet gesorteerd".

---

## 5. Layout / Views

**Desktop (≥1001px, "desk3")** = 3-koloms werkblad:
- **Links** — *In afwachting* (status=wait). Per item ✓ (goedkeuren → naar Taken) en
  ✕ (verwijderen). + om nieuw wacht-item te maken. "Geen klant" = leeg afgerond vierkantje.
- **Midden** — *Taken*. Sleepbaar (volgorde + status). Kolomkop heeft de **Jeroen & Marlon
  eigenaar-toggle** (zie §6).
- **Rechts** — *Agenda* / *Afspraken* (toggle). + na "Afspraken" maakt een afspraak.

**Mobiel** = tab-indeling. Menu-volgorde:
In afwachting · Taken · Afspraken · Agenda · **Files** · Contacten · Archief · meldingen-toggle.

**Chat** zit in de beginscherm-overlay (kunst-achtergrond + quote). Sluit via kruisje of na
opslaan van een AI-voorstel. Quote/asterisk faden weg bij typen.

**Kolomkoppen**: één gedeelde sticky `.colbar` flex-balk over de volle breedte (geen verticale
sprong meer bij scrollen). +-knop staat direct ná het woord. Titels/toggle/× op één lijn.

**Rondjes/knoppen**: dun, 60% wit, hover 100%. +-knoppen uniform als cirkel-plus.

**Dim-effect** (rust in de layout): in Taken én In-afwachting worden **alleen de gekleurde
en witte elementen** gedimd (badge, klantnaam, titel, checkbox, eigenaar-pill) op
`brightness(.4)`, tenzij je hovert of sleept. Grijze datum/projectnaam/randen blijven zoals ze zijn.

---

## 6. Eigenaar-toggle Jeroen & Marlon

- Staat in de **Taken-kolomkop** (zelfde stijl als de kop), met een **"&"** ertussen.
- Default: **beide actief** (wit = actief).
- Eén aanklikken → toont alleen die persoon. Klik op de "&" → reset naar beide.
- Ook in het **afspraak-venster** zit deze toggle in de kop (`_apptOwner` state +
  `setApptOwner` / `_renderApptWho`).

---

## 7. Gestileerde dropdowns (Klant / Project)

Mechanisme: `_enhanceSelect(sel, kind)` verbergt de echte `<select>` en bouwt een custom
`.cdd`-dropdown eroverheen; bij keuze wordt `dispatchEvent('change')` op de echte select
afgevuurd → **bestaande opslaglogica blijft intact**.

- `_formBadge(kind, v)` → `{col, ch}` (kleur + letter) voor klant/project.
- Namen staan in de **klantkleur**.
- Toegepast op: taak-bewerkvenster (m_client/m_project), afspraak-venster
  (a_clientk + a_project, gesplitst), contact-venster, en de **filters in Taken**
  (klanten- én projecten-dropdown, beide vol-breed als item-kaart; project-optie =
  klant-badge + projectnaam; geen "Alle", geen nummers; klanten zonder project niet
  in de projectenlijst; klantkleuren ook in de dropdowns).

**Bron-recolor**: klik op "↪ bron"-pill van een taak → tekst/icoon/datum van die bron
tijdelijk in de klantkleur; reset bij klik elders.

---

## 8. Animaties (Taken ↔ In afwachting)

- **Goedkeuren**: eerst schuift op de chronologische plek een **ruimte open (1,5s)**,
  daarna **vliegt** het item daarheen — met inertie.
- Techniek: **FLIP** voor soepel ruimte maken; WAAPI `element.animate` met
  `cubic-bezier(.16, 1, .3, 1)` (easeOutExpo).
- **Slepen**: taken sleepbaar Taken↔In-afwachting (statuswissel) + herordenen binnen
  In-afwachting, met soepele FLIP bij ruimte maken.

---

## 9. File manager (Files-view) — het grote hoofdstuk

Doel: Mac-achtig, minimalistisch, rustig. **Twee kolommen**: links de tree, rechts een
snelle preview (kolom 2).

### Tree
- `_renderFmTree()` groepeert `state.files` → **Klant → Project → AI-map (categorie) → bestanden**.
- Categorie van een bestand = `f.icon` (of "Niet gesorteerd").
- Klant-niveau bestanden: `owner_type='client'`, pseudo-project `pid='__alg__'` ("Algemeen").
- Bestanden zonder project: `pid='__none__'` ("Losse bestanden").
- **Mappen krijgen de kleur van de klant.** Mappen verschijnen **alleen als ze gevuld zijn**
  (on-demand; AI maakt ze niet leeg aan).
- Bovenaan: zoekvenster + knop **"Sorteer met AI"** + knop **"Sync naar Dropbox"**.

### AI-sortering — VASTE mapnamen (verzint nooit nieuwe)
`api/sortfiles.mjs` (haiku). De toegestane vocabulaire is bewust kort gehouden:
- **Project-mappen:** Concept, Lichtontwerp, Decor, Tekeningen, Plattegronden, Draaiboek,
  Planning, Leveranciers, Techniek, Offertes, Media.
- **Klant-mappen:** Contracten, Huisstijl, Logo's, Facturen, Overig.
- Namen die voor Jeroen (vormgever) én Marlon (event manager) logisch zijn.
- Bij twijfel: project → "Concept", klant → "Overig". Buiten de lijst = niet toegestaan
  (server valideert en corrigeert).
- Front: `fmSortAI()` POST't ongesorteerde files → schrijft `files.icon` terug in Supabase.

### Reorganiseren via slepen (alleen in de app)
- `fmDragStart / fmDragOver / fmDragLeave / fmDrop`. Slepen verandert `icon` (=categorie) +
  `owner_type/owner_id`, en update Supabase. Puur app-indeling; raakt Dropbox niet.

### Sync naar Dropbox (knop, op aanvraag)
- `fmSyncDropbox()` verzamelt items `{link, name, target='Klant/Project/Map'}`, vraagt
  bevestiging, POST `{action:'sync'}` → `api/dropbox/list.mjs`.
- Server resolved pad via `sharing/get_shared_link_metadata`, maakt mappen onder
  `/Begeister/<target>`, en `files/move_v2`. Trekt zo de **fysieke** Dropbox-structuur
  gelijk met de app-structuur.

### Preview (kolom 2)
- `fmFileClick(id)` → op desk3 `fmPreview(id)` (in `#view-filespreview`), anders `openFileViewer`.
- **Inline-preview via proxy:** `api/fileproxy.mjs` haalt het Dropbox-bestand server-side op
  en serveert het met `Content-Disposition: inline`.
  - **Waarom:** `dl.dropboxusercontent.com` forceert een **download**-dialoog (dat was de bug
    "ik krijg een opslaan-venster als ik op een bestand klik"). De proxy lost dat op.
  - Gebruik altijd: `'/api/fileproxy?u=' + encodeURIComponent(_fvRaw(f.link))` voor img/iframe.
  - Ook `fvRender` (volledige viewer, PDF/afbeelding) gebruikt deze proxy.

### Drag-to-upload (NIEUWSTE — net opgeleverd)
Sleep bestanden **vanaf de computer** de Files-view in → upload naar Dropbox + koppelen.
- **Drop-overlay:** zodra je OS-bestanden over `#filesWrap` sleept verschijnt een overlay
  ("Sleep bestanden op een map om te uploaden"); tijdens uploaden toont 'ie "Uploaden… (n)".
  CSS-klasse `fm-dropping` op `#filesWrap`, overlay `.fm-drop-overlay` (pointer-events:none
  zodat de mappen eronder droppable blijven).
- **Drop-doelen:** klantrij (`__alg__`), projectrij (echte `pid`) én categorierij (met cat).
  `fmDrop` detecteert OS-bestanden via `e.dataTransfer.files` (vs. interne sleep via `_fmDragId`).
- **Upload:** `fmUploadFiles()` → `_fileToB64()` (FileReader) → POST `{action:'upload', name,
  b64, target, owner_type, owner_id, cat}` naar `api/dropbox/list.mjs`.
- **Server (`upload`-actie):** maakt mappen aan, upload bytes via
  `content.dropboxapi.com/2/files/upload` (let op: **andere host** dan de JSON-API,
  body = binair, arg in `Dropbox-API-Arg`-header), maakt shared link, insert in `files`
  met `owner_type/owner_id/icon=cat`. Geeft de nieuwe rij terug → tree ververst.
- **Limiet:** base64 in JSON-body; `express.json({limit:'25mb'})` → bestanden tot ~18MB.
  Grotere bestanden falen (nog) — acceptabel voor nu.

---

## 10. Iconen

Eigen icoonset (Tabler-stijl) i.p.v. unicode. Kalender/klok-iconen uit de set i.p.v. ▦ / ◷.
Bestandstype- en UI-iconen via de eigen set (`icongen.py` / `art-samples`).

---

## 11. WhatsApp-intake (status)

- De ketting (WhatsApp → Meta → webhook → `api/intake.mjs` → app) **werkt** — getest via
  Meta's Test-knop + Railway-logs.
- `api/intake.mjs`: de WhatsApp-POST antwoordt direct 200 en verwerkt daarna async
  (`Promise.resolve(handleEvent(req.body)).catch(...)`).
- **Enige blokkade:** de Meta-app is **nog niet gepubliceerd** → er stroomt geen
  productie-data tot de app live is. Vereist **Business Verification**.
  - Legal name moest matchen met KvK: **"Cprs"** (niet "Begeister"). Ingevuld, mail bevestigd,
    staat **"in review"** (~2–10 werkdagen).
  - Er staat een geplande herinnering om de verificatie te checken (30 juni 10:00).
- Na publicatie/verificatie stromen echte berichten binnen.

---

## 12. Conventies & valkuilen

- **Taal**: alles in het Nederlands (UI, commits, comments).
- **Marlon = zij/haar.** Mappen/taken zonder eigenaar = van beiden.
- **Folder-namen kort**, vaste vocabulaire, on-demand aangemaakt.
- **Interne paden nooit tonen** aan de gebruiker (geen `/sessions/...`, geen PAT).
- Edit/Write betrouwbaarder dan bash voor bestandsbewerking.
- Bij live-verificatie via Chrome MCP: de **welkom-overlay** moet elke load gesloten worden.
- Server-restart (~60–90s) nodig na wijzigingen in `server.mjs` / `api/*.mjs`.

---

## 13. Belangrijkste bestanden

| Bestand | Rol |
|---|---|
| `public/index.html` | Hele frontend |
| `server.mjs` | Express-server, route-mounts, intake-cron |
| `api/intake.mjs` | Mail/WhatsApp-intake + AI-extractie |
| `api/chat.mjs` | Chat → taken/afspraken |
| `api/spark.mjs` | Quote/spark (haiku) |
| `api/sortfiles.mjs` | AI file-categorisatie (vaste mappen) |
| `api/fileproxy.mjs` | Inline-bestandsproxy (preview-fix) |
| `api/dropbox/list.mjs` | Dropbox: list/search/link/scan/apply/sync/**upload** |
| `api/notify.mjs`, `api/push.mjs` | Web-push |
| `lib/dropbox.mjs` | `svc()` (service-client) + `getAccessToken()` |

---

## 14. Openstaand / TODO

- **Drag-to-upload**: opgeleverd en gedeployd — **nog live testen met één bestand**
  (binaire pipeline kon blind niet getest worden).
- **WhatsApp**: wachten op Business Verification → daarna app publiceren.
- **Begeister-PDF's**: er staan PDF's fysiek in de Dropbox `/Begeister`-map die nog
  niet in de app gekoppeld zijn; verschijnen pas na koppelen/uploaden.
- Klein: sluit-×'jes overal exact gelijk uitlijnen (taak #31).
- Mogelijk obsoleet: VPS install-script/Caddy/pm2 (taak #39) — waarschijnlijk overbodig
  sinds Railway.

---

## 15. Allerlaatste werk in deze sessie

Drag-to-upload voor de Files-view gebouwd + drop-overlay, en de `upload`-actie toegevoegd
aan `api/dropbox/list.mjs`. Gecommit en gepusht
("Files: drag-to-upload bestanden naar Dropbox + drop-overlay").
Te doen: even live testen door een bestand op een map te slepen.
