# Klantportaal — startcontext voor het nieuwe project

Alles wat een verse sessie moet weten om aan het klantportaal te beginnen. Gemeten in de
draaiende app en de database op 10 juli 2026 (teamapp v209).

Kopieer naar de nieuwe projectmap, samen met `HUISSTIJL.md` en `COMPONENTEN.md`.

Achtergrond staat in `KLANTPORTAAL-PLAN.md` (de afgetekende blauwdruk). Dit document is de
uitvoering: wat er is, wat er ontbreekt, en waar je je vingers aan brandt.

---

## 0 · Lees dit eerst — het portaal kan vandaag alle klantdata lekken

De teamapp gebruikt Supabase Auth (e-mail + wachtwoord) met de publishable key in de
browser. De policies zijn daar destijds op afgestemd. Ze zeggen dit:

| Tabel | RLS | Policy | Wat dat betekent |
|---|---|---|---|
| `projects` | aan | `auth.role() = 'authenticated'` | **elke** ingelogde gebruiker leest **alle** projecten |
| `items` | aan | idem | idem |
| `sources` | aan | idem | alle mail, alle klanten |
| `attachments` | aan | idem | alle bijlagen |
| `documents` | aan | `true` | leesbaar zónder login |
| `comments` | aan | `true` (anon + authenticated) | leesbaar zónder login |
| `files`, `contacts`, `folders`, `usage`, `app_context` | **uit** | — | geen enkele grens |

`project_board` (aan, 2 policies) bevat de prijzen. `documents` bevat de offertes.

Zolang jij de enige gebruiker bent, is dit hooguit slordig. **Zodra je één klantaccount
aanmaakt in dezelfde Supabase-instantie, wordt die klant `authenticated`** — en kan hij met
de publishable key (die gewoon in de JS van de teamapp staat) via devtools of `curl` de
projecten, mail, bestellijsten en marges van álle andere klanten uitlezen. De server-side
`/api/portal-*`-route uit het plan beschermt daar niet tegen: het lek loopt om jouw
endpoints heen, rechtstreeks naar PostgREST.

**Doe dit vóór het eerste klantaccount bestaat:**

1. Zet RLS aan op `files`, `contacts`, `folders`, `usage`, `app_context`.
2. Vervang overal `auth.role() = 'authenticated'` en `true` door een expliciete check op
   een teamrol, bijvoorbeeld `auth.jwt() ->> 'rol' = 'team'` (of een `team_users`-tabel).
   Klantaccounts krijgen die rol niet en zien dus niets rechtstreeks.
3. Laat het portaal **nooit** met de publishable key data ophalen. Alleen `auth` voor de
   login; alle inhoud via `/api/portal-*` met de service-role sleutel, server-side.

Stap 1 en 2 raken de teamapp: die moet daarna een teamrol in z'n JWT hebben. Test het op
een Supabase-branch voordat je het op productie zet. Dit is geen bijzaak — het is het
verschil tussen een portaal en een datalek.

Ook nu al onnodig: `documents` en `comments` staan open voor `anon`. Dat mag sowieso dicht.

---

## 1 · Wat je bouwt

Een afgeschermde omgeving per klant. Wij zetten een **debrief** klaar met een
**deliverables**-lijst ("zo hebben wij het begrepen — klopt dit?"). De klant reageert,
corrigeert, en geeft **akkoord** — dat akkoord ís de opdrachtbevestiging. Daarna levert de
klant aan wat wij nodig hebben (**aanleveringen**), en ziet hij zijn offerte, de
vrijgegeven documenten en de status.

Twee spiegellijsten: **Opleveringen** (wat wij geven) ↔ **Aanleveringen** (wat zij geven).

### Vastgestelde keuzes — niet heropenen zonder reden

1. Eén login per klant, niet per persoon. Akkoord wordt namens het account vastgelegd.
2. Inloggen met e-mail + wachtwoord via Supabase Auth. Wij zetten het account aan, geven
   de gegevens door, klant wijzigt zelf. Geen mailinfra.
3. Na akkoord gaat de debrief + offerte **op slot**, met zichtbare slotstatus. Wij kunnen
   heropenen.
4. Geen PDF. De registratie in de app (wie, wanneer, snapshot) is de opdrachtbevestiging.
5. Reageren op de hele debrief, niet per regel.
6. Meldingen naar de klant alleen via PWA-push + "nieuw"-markeringen in het portaal.
7. De klant ziet **nooit** inkoop, marge, of een andere klant. Server-side afgedwongen.

---

## 2 · Losse repo — wat je meeneemt en wat je achterlaat

Je bouwt in een eigen map/repo, niet in `BegeisterV3`. Dat is verdedigbaar (de klantkant
en de teamkant horen niet in één bundel te zitten), maar je dupliceert wel wat.

**Meenemen:**

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-only, nooit in de browser)
- De Supabase publishable key — **alleen** voor `supabase.auth`, nergens anders voor
- `ANTHROPIC_API_KEY` als het portaal AI gebruikt (voorlopig: niet nodig)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` voor push naar beide kanten
- `APP_BASE_URL` → wordt het portaal-domein
- De patronen uit `lib/usage.mjs` (`svc()` = service-role client) en `api/push.mjs`
- Het servicework-/PWA-recept uit `public/` (manifest, service worker, icons)

**Achterlaten:** intake/IMAP, Dropbox, WhatsApp, de hele `sources`-pijplijn, `chat.mjs`,
`triage.mjs`. Het portaal leest, het verzamelt niet.

**Nieuwe env:** `PORTAL_BASE_URL`, en een aparte `CRON_SECRET` als je iets periodiek doet.

**Deelt met de teamapp:** dezelfde Supabase-instantie (databank én storage bucket
`intake`). Dat is precies waarom hoofdstuk 0 eerst moet.

---

## 3 · Stack en deploy

- Node 20, `type: module`. Express (`server.mjs`) + losse handlers per endpoint in `api/*.mjs`
  met de Vercel-signatuur `export default async function handler(req, res)`.
- Frontend: vanilla JS, één HTML-bestand, geen buildstap. Zo werkt de teamapp ook, en het
  scheelt je een toolchain die niemand onderhoudt.
- Hosting: Railway, via GitHub. Project `27b6aae8-8811-4ffc-9e0b-038f29edd0dd` is de
  teamapp — het portaal wordt een **nieuwe service**.
- Supabase: project `rwevsqwvgqbzypaudzuj`, storage bucket `intake`.

**Gebruik in deze repo vanaf dag één echt git.** De teamapp wordt via GitHub-webupload
gedeployed, en die "Commit changes"-knop reageert niet op `find` + klik — daar zijn vier
commits aan verloren gegaan. In een verse repo heb je die last niet: `git push` en klaar.

---

## 4 · Datamodel

**Hergebruikt:** `projects` (klant, project, kleur, fase), `files`, `comments`,
`appointments`, `project_board` (posten — maar alleen de klantzichtbare kant!).

**Nieuw:**

| Tabel | Wat erin zit |
|---|---|
| `client_users` | koppelt een Supabase-Auth-gebruiker aan een `client` (tekst, zoals in `projects.client`) |
| `debriefs` | onze debrief per project + status (concept / gedeeld / akkoord) |
| `deliverables` | wat wij leveren; regels per debrief, evt. gekoppeld aan een offertepost |
| `quote_lines` | offerteposten (label, aantal, stukprijs, btw). Losgekoppeld van inkoop, zodat marge niet kan uitlekken |
| `approvals` | wie, wanneer, en een snapshot/hash van wat is goedgekeurd |
| `aanleveringen` | getypeerde regels: bedrag / hoeveelheid / bevestiging / bestand / tekst, met status open of aangeleverd |

**Aanpassingen aan bestaande tabellen:** `files` krijgt `visible_to_client boolean default
false`. `comments` krijgt een klant-auteur en `visible_in_portal`, zodat interne
@mention-opmerkingen gescheiden blijven van klantreacties.

Let op de bestaande eigenaardigheid: `documents.category` is `NULL` waar `files.icon` een
lege string is. Twee tabellen, twee conventies voor "geen map". Erf die fout niet.

---

## 5 · Het design system meenemen

Je hebt nu drie bronnen, in volgorde van gezag:

1. **Het huisstijlboek in Claude Design** — jouw beslissingen.
2. **`HUISSTIJL.md`** — de gemeten designtaal van de teamapp: vijf tekststaten, twee
   gewichten (300/500), vier fontmaten, vier radii, drie schaduwhoogtes, de klantkleur-
   generator `hsl(h, 58%, 64%)` met `h = (i × 47 + 13) mod 360`.
3. **`COMPONENTEN.md`** — de functionele onderdelen en hun gedrag.

### Zo komt het in dit project terecht

Claude Design houdt het design system op **organisatieniveau**: publiceer het één keer en
elk nieuw Design-project erft het automatisch. Voor de code zijn er twee routes:

- **Vanuit Claude Code, in deze repo:** `/design-sync` haalt het design system binnen,
  zodat wat je hier bouwt uit jouw echte componenten komt in plaats van uit een screenshot.
- **Vanuit Claude Design:** *Export → Handoff to Claude Code* stuurt een klaar ontwerp naar
  deze repo, en Claude Code bouwt verder op het bestaande werk.

Optioneel koppel je de Design-MCP aan je terminal, dan werkt het beide kanten op:

```
claude mcp add --scope user --transport http claude-design https://api.anthropic.com/v1/design/mcp
/design-login
```

### Doe dit, niet dat

- **Geef Claude Design échte schermen, geen palet.** In de eigen documentatie staat het
  droog: een design-systeemimport is niet beter dan zijn bron. Voer `HUISSTIJL.md` in
  samen met een screenshot van de dagkaart en van een projectdossier. Een kleurenlijst
  levert een kleurenlijst op.
- **Leg de tokens vast in code, niet in een document.** Zet in dit project één
  `public/tokens.css` met de `:root`-blokken uit `HUISSTIJL.md`. Dat bestand is de
  waarheid. Zowel `/design-sync` als iedere toekomstige sessie leest hem, en hij kan
  terug naar de teamapp.
- **Kopieer geen CSS uit `index.html`.** Daar zit 721 KB aan gegroeide uitzonderingen,
  inclusief 37 `!important`-regels in het kleur-statesblok. Neem de tokens over, niet de
  regels.

### De ene beslissing die nog openstaat

Het portaal is geen gereedschap maar een gezicht. De teamapp staat standaard *uit* —
grijs op zwart, kleur pas bij hover. Een klant die één keer per week inlogt heeft dat
niet nodig; die moet meteen zien waar hij aan toe is.

Dat betekent dat je het vijf-statensysteem moet vertalen, niet kopiëren. Waarschijnlijk:
`--s1` omhoog (`#c0c0c0`, zoals in de modals), de klantkleur permanent aan in plaats van
bij hover, en de dagkaart-taal — grote dunne typografie, veel lucht — als basis in plaats
van als uitzondering. Dat is precies de "lichte tegenhanger" die in `HUISSTIJL.md` als
open vraag staat. Beslis het in Claude Design, niet in de CSS.

---

## 6 · Gereedschap en koppelingen

### Wie is wie

Jeroen (designer, jeroen@begeister.nl) en Marlon (eventmanager). Domein: licht, decor en
eventproductie. Jeroen is designer, geen bouwvakker — detailwerk over vormgeving is het
werk, niet een onderbreking ervan.

### Werkwijze — verplicht

- Beknopt Nederlands. Geen uitroeptekens, geen "succesvol", geen eindeloze losse puntjes.
- Valideer elk `<script>`-blok met `new Function()` vóór een deploy; `node --check` op
  elke `.mjs`. Het validatiecommando staat in `VERVOLG.md` §4.
- Hoog de versiechip op bij elke deploy. Dat is de enige manier om te zien of Railway klaar is.
- Vraag toestemming vóór iets onomkeerbaars: migraties op productie, verwijderen, mail.
- Meet in de draaiende app in plaats van te vertrouwen op wat er in de CSS staat. Drie
  keer bleek de CSS iets anders te zeggen dan het scherm.
- Werk het overdrachtsdocument bij als vaste stap in de deployroutine, niet achteraf.

### MCP-koppelingen

| Koppeling | Status | Waarvoor |
|---|---|---|
| **Supabase MCP** | werkt | `execute_sql`, `apply_migration`, `list_tables`, `get_advisors`. Project `rwevsqwvgqbzypaudzuj`. |
| **Railway MCP** | werkt | `get-logs` (`types:["deploy"]` + filter), redeploy. Teamapp: project `27b6aae8-8811-4ffc-9e0b-038f29edd0dd`, service `e2e28683-dbbe-44bf-b93d-b398820b9197`, env `4ed261df-9bb2-4f63-b074-b83eb55893c7`. Het portaal krijgt een eigen service. |
| **Chrome MCP** | werkt | Deployen via GitHub-webupload, en de live app inspecteren met `javascript_tool`. |
| **GitHub MCP** | **404 op de private repo** | Wel geautoriseerd als `jrncprs-create`, maar de connector heeft geen toegang tot de repository gekregen. Daarom loopt alles via Chrome. Op te lossen in je GitHub-app-instellingen: repository access → BegeisterV3 (of, voor het portaal, de nieuwe repo). |
| **Dropbox MCP** | niet nodig | Alleen de teamapp synct bestanden. |

### Deployroute van de teamapp — en waarom die hier niet hoeft

De lokale git-checkout van `BegeisterV3` loopt ~159 commits achter en de sandbox heeft geen
pushrechten. Daarom gaat elke deploy via GitHub's webupload, aangestuurd met de Chrome MCP:

1. `navigate` naar `https://github.com/jrncprs-create/BegeisterV3/upload/main/<map>`
2. `find` het "Choose your files"-veld → `file_upload` met het absolute pad
3. Scroll omlaag, klik het commit-berichtveld, typ, klik **Commit changes**

**Valkuil:** `find` + `left_click ref` op "Commit changes" doet niets — de klik gaat
verloren. Klik op coördinaten na het scrollen (± `751,326` voor het berichtveld,
`248,556` voor de knop). Vier commits zijn hieraan verloren gegaan. De knop zakt bovendien
als je commit-bericht langer is dan ~50 tekens; er verschijnt dan een ProTip-regel.

Elke map is een aparte commit — de webuploader plaatst bestanden in de map uit de URL.

**In de nieuwe repo doe je dit niet.** Zet daar een schone git-checkout op met pushrechten
en gebruik `git push`. De hele webupload-omweg bestaat alleen omdat de teamapp-checkout
kapot is. Erf dat niet.

### Live inspecteren

De snelste manier om iets te controleren is de Chrome MCP op `https://app.begeister.nl` met
`javascript_tool` → `javascript_exec`. De Supabase-client zit daar als `sb`, de state als
`state`, en `refresh()` haalt alles opnieuw op. Zo zijn de mapnaam-bug en het
lettergewicht-verhaal gevonden: door te meten, niet te lezen.

### AI-koppeling

Anthropic API. Chat = `claude-sonnet-4-6`, kleine taken = `claude-haiku-4-5-20251001`.
Alle calls lopen via `lib/airetry.mjs` (3 pogingen, backoff) omdat de API in juli kort
`Premature close` gaf. Het portaal heeft voorlopig geen AI nodig.

### Push-meldingen

Web-push met VAPID (`lib/push.mjs`, `api/push.mjs`, tabel `push_subs`). Werkt al richting
het team. Voor de klantkant hergebruik je hetzelfde recept; de klant installeert het
portaal als PWA en zet meldingen aan. Geen mailprovider, bewust.

---

## 7 · Bouwvolgorde

Elke stap apart te deployen en te testen.

0. **Policies dichtzetten** (hoofdstuk 0). Blokkeert al het andere.
1. Fundering: `client_users`, login-pagina, `/api/portal-data` — klant ziet zijn projecten
   en vrijgegeven documenten.
2. Debrief + deliverables: teaminvoer, klantweergave.
3. Reacties in het portaal (hergebruik `comments`) + push naar het team.
4. Akkoord = opdrachtbevestiging: `approvals`, snapshot, slotstatus, melding.
5. Offerte met posten: `quote_lines`.
6. Aanleveringen + uploads.
7. Meldingen team → klant via PWA-push.
8. Teampaneel afmaken: uitnodigen, vrijgeven, publiceren.

---

## 8 · Openstaand in de teamapp, relevant voor jou

- `renameClient` werkt alleen `projects.client` bij, niet `contacts.company`. Een klant
  hernoemen laat zijn contacten wees achter. `client_users` gaat straks op dezelfde
  tekstsleutel koppelen — overweeg meteen een `client_id` in plaats van een naam.
- Er is geen teamrol in de JWT. Die moet er komen (hoofdstuk 0).
- Er staan drie backup-tabellen in de database (`_contacts_backup_20260709`,
  `_postvak_backup_20260709`, `_postvak_backup_ronde2`) zonder RLS. Opruimen.
