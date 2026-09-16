# Klantportaal — overdracht naar een nieuw Cowork-project

Twee delen: eerst wat je klaarzet, daarna de prompt die je plakt.

---

## Deel 1 — voorbereiden (tien minuten, één keer)

**1. Map.** Maak `~/Projects/BegeisterPortaal`. Kopieer daarin:

- `KLANTPORTAAL-CONTEXT.md` (de startcontext)
- `KLANTPORTAAL-PLAN.md` (de afgetekende blauwdruk)
- `HUISSTIJL.md` (de gemeten designtaal)
- `COMPONENTEN.md` (de componenten en hun gedrag)
- de PDF/zip/HTML uit Claude Design, zodra je die hebt

**2. GitHub.** Maak de repo `jrncprs-create/BegeisterPortaal` (privé), `git init` en push
één lege commit. Geef de GitHub-connector **repository-toegang** tot die repo — de
connector is wel geautoriseerd maar heeft nu 404 op `BegeisterV3`, en zonder die toegang
val je weer terug op de Chrome-webupload. Doe het nu, niet halverwege.

**3. Railway.** Maak in hetzelfde Railway-account een **nieuwe service** vanaf die repo.
Noteer project-, service- en environment-id — die vult de assistent straks in.

Env-variabelen op de service (waarden uit de teamapp, níet hier opschrijven):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`, `PORT`, `PORTAL_BASE_URL`.

**4. Supabase.** Niets doen. Zelfde project, `rwevsqwvgqbzypaudzuj`. De assistent begint met
de policies.

**5. Cowork.** Nieuw project, koppel de map `BegeisterPortaal`. Zet de connectors Supabase,
Railway, GitHub en Chrome aan.

---

## Deel 2 — de startprompt

Plak dit als eerste bericht.

---

Je bouwt het **klantportaal van Begeister** — een afgeschermde omgeving per klant, los van
de bestaande teamapp. Ik ben Jeroen (designer, jeroen@begeister.nl). Marlon is
eventmanager. Domein: licht, decor en eventproductie.

**Lees eerst deze bestanden in de projectmap, volledig, vóór je iets zegt:**

1. `KLANTPORTAAL-CONTEXT.md` — stack, koppelingen, datamodel, valkuilen, bouwvolgorde
2. `KLANTPORTAAL-PLAN.md` — de afgetekende blauwdruk en de zeven vastgestelde keuzes
3. `HUISSTIJL.md` — de designtaal, gemeten, niet bedacht
4. `COMPONENTEN.md` — de componenten en hun gedrag

Verzin niets. Wat je niet in die documenten vindt, meet je: in de database via de Supabase
MCP, in de logs via de Railway MCP, of in de draaiende app via de Chrome MCP.

### Wat we bouwen

Wij zetten per project een **debrief** klaar met een **deliverables**-lijst ("zo hebben wij
het begrepen — klopt dit?"). De klant reageert, corrigeert en geeft **akkoord** — dat
akkoord ís de opdrachtbevestiging, met datum en snapshot, waarna debrief en offerte op slot
gaan. Daarna levert de klant aan wat wij nodig hebben (**aanleveringen**: bedrag,
hoeveelheid, bevestiging, bestand of tekst) en ziet hij zijn offerte, de vrijgegeven
documenten en de status.

Twee spiegellijsten: **Opleveringen** (wat wij geven) ↔ **Aanleveringen** (wat zij geven).

De klant ziet nooit inkoop, marge, of een andere klant. Server-side afgedwongen.

### Koppelingen

- **Supabase MCP** — project `rwevsqwvgqbzypaudzuj`. Zelfde database als de teamapp,
  storage bucket `intake`. `execute_sql` om te kijken, `apply_migration` om te wijzigen.
- **GitHub MCP** — repo `jrncprs-create/BegeisterPortaal`, privé. Gebruik gewoon `git push`;
  de webupload-omweg van de teamapp is hier niet nodig.
- **Railway MCP** — nieuwe service voor dit portaal (ik geef je de id's). De teamapp draait
  op project `27b6aae8-8811-4ffc-9e0b-038f29edd0dd`, service
  `e2e28683-dbbe-44bf-b93d-b398820b9197`, env `4ed261df-9bb2-4f63-b074-b83eb55893c7` — kom
  daar niet aan, alleen `get-logs` als je iets wilt vergelijken.
- **Chrome MCP** — om `https://app.begeister.nl` live te inspecteren. De Supabase-client
  heet daar `sb`, de state `state`, `refresh()` haalt alles opnieuw op.

Anthropic API alleen als het portaal AI nodig heeft; voorlopig niet.

### Stack

Node 20, `type: module`. Express `server.mjs` + losse handlers `api/*.mjs` met de
signatuur `export default async function handler(req, res)`. Frontend: vanilla JS, geen
buildstap. PWA met web-push (VAPID). Hosting Railway, deploy bij push naar `main`.

### Begin hier — dit blokkeert al het andere

De policies in Supabase deugen niet voor een portaal. `projects`, `items`, `sources` en
`attachments` staan op `auth.role() = 'authenticated'`: elke ingelogde gebruiker leest
alles. `documents` en `comments` staan op `true` — leesbaar zonder login. Op `files`,
`contacts`, `folders`, `usage` en `app_context` staat RLS uit.

Zodra er één klantaccount bestaat, wordt die klant `authenticated` en kan hij met de
publishable key uit de JS van de teamapp rechtstreeks bij de projecten, mail,
bestellijsten en marges van alle andere klanten. Server-side endpoints beschermen daar niet
tegen; het lek loopt eromheen, naar PostgREST.

Dus, in deze volgorde:

1. Schrijf een migratie die RLS aanzet op de vijf open tabellen en die overal
   `auth.role() = 'authenticated'` en `true` vervangt door een expliciete teamrol-check.
2. Test die op een **Supabase-branch**, niet op productie. De teamapp moet daarna een
   teamrol in z'n JWT hebben — die aanpassing hoort erbij.
3. Leg mij het migratieplan voor vóór je het op productie zet.

Pas daarna: `client_users`, de loginpagina, `/api/portal-data`.

Het portaal haalt **nooit** met de publishable key data op. Alleen `supabase.auth` voor de
login; alle inhoud via `/api/portal-*` met de service-role sleutel, server-side.

### Vormgeving

Het huisstijlboek komt uit Claude Design; ik lever het aan als PDF, zip of HTML. De gemeten
tokens staan in `HUISSTIJL.md`: twee gewichten (300, 500), vier fontmaten (11, 12, 13, 14),
vier radii (6, 9, 12, 999), drie schaduwhoogtes, en een systeem van vijf tekststaten.

Zet als eerste vormgevingsstap:

- `public/tokens.css` met de `:root`-blokken. **Dat bestand is de waarheid.**
- `CLAUDE.md` met: lees `HUISSTIJL.md` voor je CSS schrijft; gebruik uitsluitend de tokens;
  geen losse hex-waarden.
- Een controlescript dat vóór elke deploy faalt op hardgecodeerde hex-kleuren, fontgroottes
  buiten 11/12/13/14, gewichten buiten 300/500 en radii buiten de vier tokens.

Kopieer geen CSS uit `index.html` van de teamapp — daar zit 721 KB gegroeide uitzondering.
Neem de tokens, niet de regels.

Eén beslissing staat nog open: de teamapp staat standaard *uit* (grijs op zwart, kleur pas
bij hover). Een klant die één keer per week inlogt heeft dat niet nodig. Het
vijf-statensysteem moet vertaald worden, niet gekopieerd. Vraag me daarnaar voor je de
eerste schermen bouwt.

### Werkwijze — verplicht

- Beknopt Nederlands. Geen uitroeptekens, geen "succesvol", geen eindeloze losse puntjes.
  Ik ben designer, geen bouwvakker: detailwerk over vormgeving is het werk, geen zeurpunt.
- **Meet, gok niet.** Als je een bewering doet over de code, de database of het scherm,
  controleer je die eerst. In het vorige project heb ik drie keer onjuiste informatie
  gekregen over wat er in de eigen CSS stond, tot het gemeten werd.
- Valideer elk `<script>`-blok met `new Function()` vóór een deploy, `node --check` op elke
  `.mjs`. Hoog de versiechip op — dat is de enige manier om te zien of Railway klaar is.
- Vraag toestemming vóór iets onomkeerbaars: migraties op productie, verwijderen, mail
  versturen, een klantaccount aanmaken.
- Werk het overdrachtsdocument bij als vaste stap in de deployroutine, niet achteraf.

### Bouwvolgorde

0. Policies dichtzetten.
1. Fundering: `client_users`, login, `/api/portal-data`.
2. Debrief + deliverables.
3. Reacties in het portaal + push naar het team.
4. Akkoord = opdrachtbevestiging (`approvals`, snapshot, slotstatus).
5. Offerte met posten (`quote_lines`).
6. Aanleveringen + uploads.
7. Meldingen team → klant via PWA-push.
8. Teampaneel: uitnodigen, vrijgeven, publiceren.

Elke stap apart deployen en testen.

### Begin met

1. Bevestig kort dat je de vier documenten hebt gelezen en noem één ding dat je erin bent
   tegengekomen dat ik waarschijnlijk over het hoofd heb gezien.
2. Controleer zelf, via de Supabase MCP, of de policies inderdaad zijn zoals hierboven
   beschreven — en meld het als het inmiddels anders is.
3. Leg het migratieplan voor stap 0 voor. Bouw nog niets.

---

## Wat er nog niet is

- De nepdata voor Claude Design (verzonnen klant, drie deliverables, vier aanleveringen in
  verschillende staten, offerte met posten). Zonder dat ontwerpt Design tegen lorem ipsum.
- `tokens.css` — bestaat pas als het nieuwe project hem schrijft.
- De teamrol in de JWT van de teamapp. Dat is een wijziging aan `BegeisterV3`, niet aan het
  portaal, maar hij hoort bij dezelfde migratie.
