# Opruimplan — intake, bestanden & projectdossier

_Opgesteld 9 juli 2026 · op basis van de live Supabase-data (project `rwevsqwvgqbzypaudzuj`) en `public/index.html` v165_
_Uitgevoerd 9 juli 2026 — zie §7 voor wat er daadwerkelijk gebeurd is. App staat op **v168**, nog niet gedeployed._

---

## 0. Samenvatting in vier zinnen

De intake is geen zooitje omdat het datamodel fout is, maar omdat **een mislukte poging net zoveel spoor achterlaat als een geslaagde**, en omdat **toewijzen aan een project nergens wordt afgedwongen**. Daardoor staan er 107 van de 127 bronnen zonder project, waarvan 28 pure duplicaten. De projecten waar dat materiaal heen moet — Ostrica, Bar Baggerbeest, BonBon Vivant, zelfs `Marlon Prive` — bestaan al. Wat écht ontbreekt is één documenttabel en één plek waar je een project in zijn geheel ziet.

---

## 1. Wat er precies mis is

### 1.1 De drop-intake lekt bronnen (oorzaak van 28 duplicaten)

In `_dropProcess()` (`public/index.html`, r. 6529) wordt de bron **direct** weggeschreven:

```js
// r. 6532 — dit gebeurt vóór het lezen en vóór het opslaan
const r = await sb.from('sources').insert({channel:'drop', sender:who||'Sleep', body:f.name, ...})
```

Daarna zijn er twee uitgangen die die rij níet opruimen:

| Regel | Situatie | Gevolg |
|------|----------|--------|
| 6543–6546 | `/api/readdrop` faalt | bron blijft als lege rij achter |
| 6572 | gebruiker klikt ✕ ("niet opslaan") | bron blijft als lege rij achter |

**Bewijs.** `SprinterSoundSystem_Pitch.pdf` staat 16× in `sources`, gedropt tussen 10:56 en 14:06 op 28 juni 2026 — allemaal met `summary = null`, 0 taken, 0 bijlagen. Dat is één bestand, zestien keer opnieuw geprobeerd tijdens de Anthropic-storing van die week (zie `VERVOLG.md` §6).

Hetzelfde patroon: `Projectbrief Ostrica` 3×, `Background.jpg` 2×, Amazon-mail 3×, `[spraakbericht — transcriptie mislukte]` 3×, `[afbeelding via WhatsApp]` 5×.

### 1.2 Toewijzen wordt nergens afgedwongen

Bij ✓ opslaan geldt `pid = _fileProjectId || null` (r. 6583). Kies je geen project, dan is `project_id` gewoon `null` en verdwijnt het item stil uit beeld. Er is geen scherm waar je die 107 losse bronnen ooit terugziet.

### 1.3 Bestanden leven in vier werelden

| Tabel / plek | Koppeling aan project | Rijen |
|---|---|---|
| `attachments` | indirect, via `sources.project_id` | 56 (43 verweesd) |
| `files` | `owner_type` / `owner_id` als **losse tekst**, geen foreign key | 8 |
| Dropbox | helemaal los, via `api/dropbox/*` | — |
| `insp_items` | eigen `project_id`, 16 van 17 leeg | 17 |
| `folders` | bestaat, wordt niet gebruikt | 0 |

Een offerte die per mail binnenkomt landt dus ergens anders dan dezelfde offerte die je sleept. Zoeken op projectniveau kan simpelweg niet.

### 1.4 Wat er níet mis is

Het `projects`-model (klant + project op één rij) is prima. Er is al een klant `Marlon Prive` en een klant `Begeister` met sub-projecten (Algemeen, Financien, Huisvesting, Inkooplijst). **Privé en intern materiaal hebben dus al een thuis** — het wordt alleen niet gebruikt, omdat niets je vraagt om te kiezen.

---

## 2. Wat er inhoudelijk in die 107 bronnen zit

Ruwweg drie stapels, en die vragen om verschillende behandeling:

**A. Debris (28) — weg.** Duplicaten van mislukte pogingen. Geen bijlagen, geen taken, geen samenvatting.

**B. Privé en intern (~20).** Schoolboeken van Dahli, huurcontract MVGM voor de advocaat, locatie BBQ, Marktplaats-pakket, bier in de koelkast, Comedy Womb-tickets, Talentenhuis/Meervaart-onderhuur. Hoort bij `Marlon Prive` of `Begeister · Algemeen` — niet bij een klantproject.

**C. Wél toewijsbaar, maar gemist (~55).** `Projectbrief Ostrica Incentive Athene 2027.pdf` terwijl Ostrica · Athene 2027 gewoon bestaat. Neon-lichtbak-debrief voor Onno terwijl Bar Baggerbeest bestaat. BonBonVivant-bio's terwijl BonBon Vivant · Landjuweel bestaat. De IDZ-lampenmail. Dit is de pijnlijke categorie: het systeem wíst het, maar vroeg het niet.

De rest is losse ruis (WhatsApp-flarden, schermafbeeldingen).

---

## 3. Het plan

### Stap 1 — Dicht het lek (klein, eerst)

**Verplaats de insert naar het moment van opslaan.** De bron is pas betekenisvol als hij bewaard wordt. Concreet:

- Haal de `sources.insert` uit `_dropProcess()` (r. 6532) weg.
- Doe hem in `_saveDropToWait()` (r. 6582), waar het bestand toch al beschikbaar is via `_dropFileObj`.
- Gevolg: een mislukte read of een ✕ laat niets achter.

**Bewaar de URL uit `.webloc` alvast in een variabele** in plaats van in de rij — die is nu de enige reden dat de insert vooraan staat.

Dit is een wijziging van ongeveer tien regels en lost 28 van de 107 op, structureel.

### Stap 2 — Maak toewijzen onvermijdelijk

Niet door `project_id` verplicht te maken in de database — dat dwingt nepkoppelingen af voor privé en inspiratie. Wel door het **zichtbaar** te maken:

- **Een Postvak In** als eerste kaart op het Klanten-board: "23 items wachten op een plek". Zolang daar iets staat, zie je het elke dag.
- In het opslaan-scherm is de klant/project-keuze **voorgeselecteerd** met de AI-suggestie uit `/api/readdrop` (dat endpoint geeft `client` en `project` al terug — het wordt nu alleen genegeerd als er geen exacte match is).
- Naast de projecten staan twee vaste knoppen: **Privé** (→ `Marlon Prive` of een nieuwe `Jeroen Prive`) en **Inspiratie** (→ `insp_items`). Eén klik, en het is weg uit het postvak.
- Bulk-toewijzen voor de bestaande 79: lijst met AI-suggestie per regel, jij vinkt aan en bevestigt in één keer.

### Stap 3 — Eén documenttabel

```sql
create table documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade,
  source_id    uuid references sources(id) on delete set null,
  scope        text not null default 'project',   -- project | klant
  category     text,                              -- de mappen uit sortfiles.mjs
  filename     text not null,
  storage_path text,                              -- Supabase Storage
  dropbox_path text,                              -- of Dropbox
  mime         text,
  size         bigint,
  summary      text,                              -- AI-samenvatting (bestaat al in files.summary)
  created_at   timestamptz not null default now()
);

create index documents_project_idx on documents(project_id);
create index documents_source_idx  on documents(source_id);
```

Migratie: `attachments` en `files` gaan hier eenmalig in op, met `project_id` overgenomen van de bron. De 43 verweesde bijlagen krijgen een AI-sorteerronde — die logica staat al in `api/sortfiles.mjs`, inclusief de categorielijst (Concept, Lichtontwerp, Decor, Tekeningen, Plattegronden, Draaiboek, Planning, Leveranciers, Techniek, Offertes, Media / Contracten, Huisstijl, Logo's, Facturen, Overig).

`folders` kan weg — `category` doet het werk, en die lijst is al vast.

### Stap 4 — Het projectdossier

Pas nu de moeite waard, want nu is er iets te tonen. Klik op een project → één pagina:

- kop: klant, project, rol, projectprijs, factuurstatus
- **Documenten**, gegroepeerd op `category`
- **Afspraken** (bestaat al: `appointments`)
- **Taken** (bestaat al: `items`)
- **Contacten** (bestaat al: `contacts`)
- **Financiën** (bestaat al: `project_board` + budget)
- **Tijdlijn** van bronnen: alles wat er ooit binnenkwam, chronologisch

Dit is grotendeels renderwerk. Alle tabellen wijzen dan naar hetzelfde `project_id`.

---

## 4. Opruim-SQL (pas draaien na akkoord)

Verwijdert alleen bronnen die **aantoonbaar leeg** zijn — geen bijlagen, geen taken, geen samenvatting — en houdt per groep de oudste over.

```sql
-- Eerst kijken wat er weg zou gaan:
with leeg as (
  select s.id, s.body, s.channel, s.received_at,
         row_number() over (partition by s.channel, s.body order by s.received_at) as rn
  from sources s
  where s.project_id is null
    and s.summary is null
    and not exists (select 1 from attachments a where a.source_id = s.id)
    and not exists (select 1 from items i where i.source_id = s.id)
)
select channel, body, count(*) as wordt_verwijderd
from leeg where rn > 1
group by channel, body order by 3 desc;

-- Pas daarna, met dezelfde CTE:
-- delete from sources where id in (select id from leeg where rn > 1);
```

Verwachting: 28 rijen weg, 79 bronnen over om toe te wijzen.

---

## 5. Volgorde en inschatting

| Stap | Wat | Waarom eerst |
|---|---|---|
| 1 | Lek dichten in `_dropProcess` | anders loopt de rommel door tijdens het opruimen |
| 2 | Duplicaten verwijderen (SQL hierboven) | 107 → 79 |
| 3 | Postvak In + AI-suggestie + bulk-toewijzen | de 79 krijgen een plek |
| 4 | `documents`-tabel + migratie + sorteerronde | bestanden vindbaar per project |
| 5 | Projectdossier-pagina | het overzicht dat je vroeg |

Stap 1 tot en met 3 zijn samen ongeveer een halve dag en lossen het dagelijkse ongemak op. Stap 4 is een uur of twee. Stap 5 is het ontwerpwerk.

---

## 7. Wat er op 9 juli daadwerkelijk is gedaan

### Database (live toegepast)

| Migratie | Wat |
|---|---|
| — | **19 lege duplicaat-bronnen verwijderd.** Niet 28: de strengere voorwaarde (geen bijlage, geen taak, geen contact, geen bestelregel) spaarde er negen die tóch iets vasthielden. Van de drie Ostrica-kopieën ging er één weg. |
| `documents_table_and_project_phase` | `documents`-tabel aangemaakt (incl. `visible_to_client` voor het portaal). `projects.phase` toegevoegd, default `briefing`. |
| `backfill_documents_from_attachments_and_files` | 56 bijlagen + 8 files → 64 documenten. Controle: 64 = 56 + 8. |
| `sources_triage_column` | `sources.triage` — onthoudt dat iets bewust géén project heeft (inspiratie / privé / ruis). Zonder dit blijft materiaal eeuwig terugkomen in het Postvak In. |

`attachments` en `files` zijn **niet** verwijderd. De oude tabellen blijven staan tot je het dossier hebt gezien; daarna kunnen ze weg.

### Code

- **`public/index.html`** (v167 → **v168**)
  - `_dropProcess()` schrijft geen bron meer weg vóór het lezen. Dat gebeurt nu in `_saveDropToWait()`, op het moment van opslaan. Een mislukte read of een ✕ laat niets meer achter.
  - De bron krijgt nu wél een `project_id` en een `summary` mee — die bleven allebei leeg.
  - Nieuwe pagina **Postvak In** (`renderPostvak`): toont alles zonder project, met één AI-knop die het hele postvak in één call van een voorstel voorziet. Vier uitgangen: naar project, Inspiratie, Privé, Ruis.
  - Nieuwe pagina **Dossier** (`renderDossier`): fasebalk, documenten per vaste map, taken, afspraken, contacten, tijdlijn. Per document een `klant`-vinkje dat `visible_to_client` zet — de haak voor het portaal.
  - Inspiratie gaat naar `insp_items` en genereert geen taken.
- **`api/triage.mjs`** (nieuw) — beoordeelt tot 60 bronnen in één Haiku-call. Kiest uitsluitend uit de meegegeven catalogus.
- **`api/readdrop.mjs`** — geeft nu `kind` terug (werk / inspiratie / prive). Bij `inspiratie` worden `items` server-side leeggemaakt, niet alleen ontraden.
- **`server.mjs`** — `/api/triage` gemount.

### Verificatie

- Alle `<script>`-blokken in `index.html` valideren (`ALL SCRIPTS OK`).
- `node --check` op `api/triage.mjs`, `api/readdrop.mjs`, `server.mjs`.
- 13 unit-tests op `sanitize()` in `api/triage.mjs`: verzonnen project-ids worden gewist, onbekende bron-ids genegeerd, onbekende soorten vallen terug op `werk`, een `null`-antwoord crasht niet.
- Datatelling na migratie: 108 bronnen, 88 in het Postvak In, 53 taken en 56 bijlagen onaangetast, 18/18 projecten met een fase.

### Nog te doen

1. **Deployen** — via de GitHub-web-upload (`public`, `api`, en `server.mjs` in de root). Versiechip staat al op v168.
2. Op `/api/triage` draait Haiku; controleer na de eerste run of de voorstellen kloppen vóór je in bulk bevestigt.
3. De 88 bronnen door het Postvak In halen. Verwachting op basis van de steekproef: ruwweg 20 privé, een handvol inspiratie, de rest toewijsbaar.
4. Zodra het dossier goed voelt: `attachments` en `files` opruimen, en de dubbele schrijfactie in `_saveDropToWait` (die schrijft nu naar `attachments` én `documents`) terugbrengen tot alleen `documents`.

---

## 6. Losse bevinding: RLS staat uit

`contacts`, `usage`, `files`, `app_context` en `folders` hebben **Row Level Security uitgeschakeld**. Met de publieke anon-key is elke rij in die tabellen leesbaar en schrijfbaar door iedereen die de key uit `index.html` plukt. Voor `contacts` (17 rijen met namen, e-mail, telefoon) is dat het vervelendst.

Dit staat los van de intake, maar het hoort in dit document omdat het bij het opruimen naar boven kwam. Aanzetten zonder policies blokkeert de app — dat vraagt een aparte, kleine sessie.
