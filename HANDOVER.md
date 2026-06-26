# Begeister — overdracht (voor een nieuw gesprek)

Korte context zodat een volgende sessie meteen verder kan.

## Wat is dit
Gedeelde AI-werkplek voor Jeroen & Marlon (Begeister — licht/decor/event-productie).
Eén bestand doet bijna alles: `public/index.html` (HTML + CSS + vanilla JS).
Backend: Supabase (Postgres + RLS, publishable key client-side) en Vercel serverless `/api/*.mjs`.

## Belangrijk: deploy & push-werkwijze
- **Jeroen pusht zelf** in GitHub Desktop. Claude commit alleen lokaal en zegt "klaar om te pushen". NIET zelf pushen.
- Repo: `jrncprs-create/BegeisterV3`. Commit-auteur die werkt: `jrncprs-create <jrncprs@gmail.com>`.
- **Jeroen's live app draait op `begeister-app.vercel.app`** (PWA op z'n iPhone). Er staan 3 Vercel-projecten op dezelfde repo (begeister-app, begeister, begeister-v3) — alleen begeister-app telt. Op het gratis plan verliest begeister-app soms de build-wachtrij; er is een **deploy hook** aangemaakt om 'm geforceerd te laten bouwen (Vercel → project begeister-app → Settings → Git → Deploy Hooks).
- Service worker = network-first + no-cache headers (vercel.json), zodat updates meteen binnenkomen.

## Stand van zaken (UI)
Desktop = 3-koloms werkblad (vanaf 1001px breed):
- **Links** = "In afwachting" (status=wait items), met ✓ (goedkeuren → naar Taken) en ✕ (afwijzen → verwijderen).
- **Midden** = "Taken" (sleepbaar om volgorde te bepalen; volgorde in localStorage `task_ord`). Klanten als dropdown + "+ Klant beheren". "+"-knop = nieuwe taak (in-kolom venster).
- **Rechts** = "Agenda" (kalender lijst/week/maand) + "+"-knop = nieuwe afspraak (in-kolom venster).
Mobiel = oude tab-indeling.
Chat zit in de **beginscherm-overlay** (kunst-achtergrond + quote). Overlay sluit via kruisje of na opslaan van een AI-voorstel. Quote/asterisk faden weg zodra je typt.
Rondjes overal: dun, 60% wit, hover 100%.

## Afspraken (appointments)
Aparte Supabase-tabel `appointments` (sql in `sql/appointments.sql`) — **is al aangemaakt** in Supabase (project ref `rwevsqwvgqbzypaudzuj`). AI kan afspraken plannen via chat (chat.mjs → `appointments`), push via /api/notify.

## Openstaande TODO (was bezig toen sessie eindigde)
**"AFSPRAKEN"-toggle in de agendakolom**: links naast de +-knop een tekstknop (zelfde font als de kolomlabels) die binnen de rechterkolom wisselt tussen de kalender (AGENDA) en de afsprakenlijst (AFSPRAKEN).
- Helper `afsprakenGroupsHTML()` moet uit `renderAfspraken()` getrokken worden (gedeelde lijst-builder).
- `renderAgenda()` moet, bij een mode `agendaCol==='afspraken'`, die lijst tonen i.p.v. de kalender en op `#view-agenda` een class zetten zodat het ::before-label "Afspraken" wordt (`.main.workspace #view-agenda.afsprakenmode::before{content:"Afspraken"}`).

## Bekende hapering
Tool-calls verschijnen soms als TEXT i.p.v. uitgevoerd te worden ("court &lt;invoke...&gt;"). Een nieuw gesprek reset dit. Edit/Write zijn betrouwbaarder dan bash/computer-use.
