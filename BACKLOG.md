# Begeister Workflow — Uitvoerbacklog

_Aangemaakt 14 juli 2026 · hoort bij HANDOFF.md · live versie **v244**_

> Stand 15 juli 2026: alles is af behalve **U11** (agenda-sync — wacht op OAuth-keuze),
> **U14** (boekhoudkoppeling — wacht op pakketkeuze + API-sleutel) en **Fase 7**
> (klantportaal U18/U19 — eigen sessie afgesproken).

Elk item hieronder is een **uitvoeritem**: zeg in een chat "doe U3" en Claude voert het uit
(bouwen → valideren → versiechip ophogen → deployen → verifiëren). Volgorde = aanbevolen volgorde.
Omvang: S = binnen één sessie, M = één sessie met testen, L = meerdere sessies.

Status bijhouden: `[ ]` open · `[~]` bezig · `[x]` klaar (+ versienummer).

---

## Fase 0 — Datahygiëne ✅ AFGEROND 14 juli 2026

- [x] **U0a — Ostrica projectprijs corrigeren** (S) — €45.000 gezet
  `projects` → Athene 2027: projectprijs €700 → **€45.000** (of exact bedrag van Jeroen).
  Klaar: Financiën toont reële omzet/marge voor Ostrica.
- [x] **U0b — 8 dubbele documents-rijen verwijderen** (S) — uitgevoerd, RETURNING geverifieerd
  De `documents`-kopieën (origin='file') van 8 bestanden in Athene 2027, Begeister app en
  Inkooplijst. De `files`-rijen (met voorstel-vlaggen) blijven. IDs staan in de chat van 14 juli.
  Klaar: geen bestand meer dubbel in app of portaal.
- [x] **U0c — 35 onzichtbare bestanden zichtbaar gemaakt** (S) — 34 naar Begeister/Algemeen + 1 wees herkoppeld; controlequery: 0 wezen over
  `files` met owner_type='project' + owner_id='Begeister' → owner_type='client', zodat ze
  verschijnen onder Begeister/Algemeen. Incl. de wees houten-planken-textuur.jpg (herkoppelen).
  Klaar: jaarrekening, VvE-stukken, Athene-pitchdeck e.d. zijn terug in beeld.
- [x] **U0d — 3 backup-tabellen gedropt** (S) — migratie drop_backup_tabellen_opruimen
  `_contacts_backup_20260709`, `_postvak_backup_20260709`, `_postvak_backup_ronde2`.
- [x] **U0e — Wees-preventie in de dropcode** (S) — v234: _veiligeOwner() op alle drie koppelplekken, live getest
  Guard in index.html: een file-rij mag alleen owner_type='project' krijgen met een geldige
  project-UUID; anders automatisch 'client'. Voorkomt dat U0c ooit opnieuw nodig is.

## Fase 1 — Overzicht & dashboard ✅ AFGEROND 15 juli 2026 (v237)

- [x] **U1 — "Vandaag"-dagoverzicht compleet** (M) — v235. Ontdekking: er bestónd al een
  dagoverzicht (zonnetje-knop rechtsboven + automatisch 1x/dag na het welkomstscherm) met
  afspraken, deadlines, wacht-op, waar-ligt-de-bal en weer. Toegevoegd: kaart "Nieuw sinds
  gisteren" (mail/WhatsApp/drops laatste 24u, klik -> Postvak). Kaart verbergt zichzelf als leeg.
- [x] **U2 — Wachten-op-bewaking** (M) — v237. Kolom `items.wait_sinds` + DB-trigger die hem op
  élk pad bijhoudt (status → wait zet de klok, weg van wait wist hem); "op wie" = het bestaande
  contact-veld. Wacht-pil toont het aantal dagen (7+ kleurt rood); dagoverzicht-kaart "Wacht op"
  sorteert op langst wachtend; 7+ dagen verschijnt als signaal bij U4.
- [x] **U3 — Pijplijn-kanban over alle projecten** (M) — v237. Nav-knop "Pijplijn": overlay-bord
  met vijf fasekolommen, projectkaarten met klantkleur + projectprijs, kolomtotalen. Slepen =
  fase wijzigen (factuurstatus beweegt mee, zelfde logica als de fasebalk); klik opent dossier.
- [x] **U4 — "Heeft aandacht nodig"-signalen** (M) — v237. Kaart op het dagoverzicht met vier
  detecties: taak over deadline (rood), 7+ dagen wachten op iemand (U2), voorstel 7+ dagen
  zonder reactie (klik = herinneringsmail, U10) en project 14+ dagen stil. Vervangt de losse
  "Langst stil"-kaart.

## Fase 2 — Taken & todo ✅ AFGEROND 14 juli 2026 (v236)

- [x] **U5 — Deadlines, herinneringen en "vandaag doen"** (M) — v236. Deadlineveld bestond al;
  toegevoegd: "vandaag"-pil op elke taakkaart (items.vandaag, vervalt vanzelf na de dag), groep
  "Vandaag doen" bovenaan Taken, telt mee in het dagoverzicht, en ochtendpush 07:30 NL-tijd per
  persoon (deadline vandaag/te laat + vandaag-selectie) via cron in server.mjs.
- [x] **U6 — Terugkerende taken** (S/M) — v236. Herhaal-keuze in het taakvenster (wekelijks/
  maandelijks/per kwartaal, items.herhaal). Bij afvinken maakt _maybeRepeat() automatisch de
  volgende aan (checklist gereset, deadline één periode verder, nooit in het verleden). ↻-pil
  op de kaart.
- [x] **U7 — Bestaande losse taken hergroeperen** (S) — uitgevoerd 14 juli: 38 losse kaartjes
  uit 12 bronnen samengevoegd tot 12 kaarten met checklist (titel = bron-samenvatting; files/
  comments herkoppeld; controle: 0 wezen).

## Fase 3 — Directiesecretaresse ✅ AFGEROND 14 juli 2026 (v236)

- [x] **U8 — Antwoordconcepten bij intake** (M) — v236. De intake-extractie levert nu ook een
  concept-antwoord (sources.suggest_reply); de poller zet hem direct klaar bij nieuwe mails.
  In het Postvak: blok "Antwoordconcept" onder de mailpreview (bewerkbaar) met Open in Mail
  (mailto Re:), Kopieer en ✦ voor bestaande mails (nieuw endpoint /api/reply).
- [x] **U9 — Spraakmemo-transcriptie** (M) — v236. Audio-drops (.m4a/.mp3/.wav/…) gaan in
  api/readdrop.mjs eerst door de bestaande Groq Whisper-helper (lib/transcribe.mjs) en daarna
  door de normale extractie → samenvatting + actiepunten; de transcriptie wordt als brontekst
  bewaard. Vereist GROQ_API_KEY op Railway (stond er al voor de dictafoon).
- [x] **U10 — Follow-upmachine (versimpeld, afgestemd met Jeroen)** (M) — v236. Voorstel
  markeren = verstuurd_op gezet (files + documents; bestaande voorstellen ge-backfilled op
  aanmaakdatum). Dagoverzicht-kaart "Opvolgen": voorstellen 7+ dagen zonder akkoord op dat
  spoor; klik = herinneringsconcept in Mail (contact van het project als we er één kennen).
  Volledige versie (facturen, U12-pijplijnstatus) volgt bij Fase 5.

## Fase 4 — Agenda

- [ ] **U11 — Agenda-sync met Google/Apple Calendar** (L)
  Tweeweg-sync van `appointments` via Google Calendar API en/of CalDAV. OAuth-koppeling per
  teamlid. Grootste losse bouwsteen van deze backlog. Wacht op keuze + OAuth-setup van Jeroen.
- [x] **U11b — Afspraakdetectie uit intake** (S/M) — v238. De intake-extractie herkent expliciete
  afspraken met datum/tijd (sources.suggest_appts). In het Postvak verschijnt "Gevonden
  afspraken" onder de mailpreview met een Inplannen-knop → agenda-item, gekoppeld aan het
  project van de bron.

## Fase 5 — Financiën

- [x] **U12 — Offerte/factuur-pijplijn** (M) — v238. Status per financieel document
  (files/documents.fin_status: concept → verstuurd → akkoord → betaald) als klikbare pil in het
  Offerte & Factuur-blok; "verstuurd" legt eenmalig verstuurd_op vast. Klantregel op Financiën
  toont het openstaande saldo (gefactureerd, nog niet betaald, incl. btw). De projectpijplijn
  (fase → factuurstatus + cashflowkaarten) bestond al.
- [x] **U13 — Kwartaal-/jaaroverzicht** (M) — v238. Blok "Per kwartaal" op de Financiën-pagina:
  omzet (zeker, ex btw, op factuurdatum of anders projectstart), betaalde kosten (ex btw) en
  marge per Q1–Q4 + jaartotaal, met ‹ jaar ›-navigatie.
- [ ] **U14 — Boekhoudkoppeling (Moneybird / e-Boekhouden)** (L)
  Facturen en betaalstatus synchroniseren zodat niets dubbel wordt bijgehouden. Wacht op
  pakketkeuze + API-sleutel van Jeroen (afgesproken 15 juli: overslaan tot die er zijn).

## Fase 6 — Bestanden & zoeken

- [x] **U15 — Eén zoekbalk over alles** (M/L) — v238, pragmatisch: loep in de topbar + ⌘K/Ctrl+K
  opent een zoek-overlay over alles wat de app al in het geheugen heeft: taken (incl.
  checklistpunten), mail & bronnen (incl. volledige tekst en spraakmemo-transcripties),
  bestanden, afspraken en contacten. Postgres full-text-index kan later alsnog als de datamassa
  het client-side zoeken ontgroeit; bestandsinhoud-extractie-opslag staat dan mee op de rol.
- [x] **U16 — AI-hersortering van het bestaande archief** (M) — uitgevoerd 15 juli via de
  bestaande /api/sortfiles-batch: 3 ongesorteerde bestanden kregen een map; 0 verplaats-
  voorstellen. De "Sorteer met AI"-knop op Bestanden blijft voor de toekomst.
- [x] **U17 — Wekelijkse gezondheidscheck** (S/M) — v238. lib/gezondheid.mjs + cron in
  server.mjs (maandag 08:00 NL): dubbele bestandsnamen per project, wezen (onbekend
  project/verwijderde taak) en rare financiële waardes (geen/verdachte projectprijs voorbij
  briefing) → één taakkaart "Gezondheidscheck — bevindingen" met checklist + push. Geen
  bevindingen = stil, en een oude open kaart sluit zichzelf.

## Op verzoek (15 juli 2026)

- [x] **L1 — Leestafel: reviewscherm voor AI-vondsten** (M) — v239, gevraagd door Jeroen.
  Paginagroot overzicht (stijl dagoverzicht) dat opent nadat de AI een drop/plak/spraakmemo
  heeft gelezen: elke vondst als eigen regel met aan/uit-vinkje, bewerkbare tekst en typekeuze
  Taak / Subpunt / Afspraak / Notitie; per type velden (wie/deadline resp. datum/tijd/waar);
  gevonden contacten als aparte regels. Knoppen: Toepassen (subpunten → één kaart met checklist,
  taken → losse kaarten, afspraken → agenda, contacten → Contacten), Later invullen (voorstellen
  bewaard in sources.suggest_items, heropenen via de Leestafel-knop in het Postvak) en Annuleren
  (= alleen het bestand bewaren). Elke bestaande bron heeft in het Postvak een Leestafel-knop
  die de bron (opnieuw) laat lezen of de bewaarde voorstellen heropent. Mail-intake blijft
  automatisch.

- [x] **L2 — Planning-verbouwing** (L) — v240, ontworpen met Jeroen (schetsen 15 juli).
  Drie-kolommenflow hersteld en verfijnd: meerdere bestanden tegelijk slepen met per bestand
  voortgang (tekst + balk) bovenin de linkerkolom; drops worden zonder overlays automatisch
  gelezen en verschijnen als accord-kaart bij In afwachting (AI vult in — regels aan/uit,
  tekst bewerkbaar, taak/afspraak-toggle, klant/project-keuze; ✓ akkoord → losse taken en
  agenda-items). Middenkolom toont bundelvensters per klant · project in de klantkleur, met
  bronkoppen (streep + ↪ bron rechts) voor punten uit één document; regel = hokje · zin
  (klik = bewerken-venster) · klein ↪; afgevinkt = gedimd + × om te verwijderen. Bewerken-
  venster is slanker (checklist- en bestandenblok weg, Opmerkingen blijft). De mail-poller
  maakt voortaan losse punten per actiepunt; de app bundelt ze in beeld. "Vandaag" komt in
  een volgende stap terug als tijdskop.

- [x] **L3 — Planning-verfijning** (M) — v241, feedback Jeroen 16 juli.
  Pijplijn- en Financiën-knoppen tijdelijk uit het menu (achterkant blijft staan; Financiën
  wordt later opnieuw ontworpen). Klantkleur nu ook op de venster-badge; huisstijl-vinkjes
  ook in dossier/projectbord. Klik op "bron" in de middenkolom opent de bron als overlay
  (voorbeeld + afspraak-/antwoordvoorstel + knop naar Postvak). Scrollbar-flits en breedte-
  schaling bij klikken opgelost (desktop: body scrollt niet meer). Per venster en per
  broncluster een inklap/uitklap-pijltje rechts (onthouden), kruisje rechts op de venster-kop
  (alles verwijderen, met bevestiging) en op elke regel; bronkop-titels afgekapt op 48 tekens.

- [x] **L4 — Kleine schaafronde** (S) — v242, feedback Jeroen 16 juli.
  Verwijderen bevestigt overal op de knop zelf (rood "zeker?", tweede klik binnen 4s =
  weg) — geen bevestigingsvenster meer. Huisstijl-vinkjes in klantkleur nu ook in het
  dossier-venster. Projectprijs: bedrag + euroteken rechts zonder kader; regels zonder
  bekende waarde (Inkoop €0, Winst —) worden weggelaten. Dagoverzicht voorlopig uit
  beeld (knop en auto-open weg; code blijft staan).

- [x] **L5 — Toewijzen + aandacht-push met doorklik** (M) — v243, gevraagd door Jeroen 16 juli.
  Toewijzen aan de ander (bestaande Wie-vinkjes) en @mentions in opmerkingen sturen al een
  push; die meldingen linken nu naar het item zelf: klik op de push opent de app mét dat
  item open (deep link /?item=… en /?project=…; staat de app al open dan geeft de service
  worker het adres door zonder herladen). Nieuw: aandacht-knop in het bewerken-venster —
  één regeltje typen → push naar de ander ("Jeroen → jou: …", klik = item open) én
  dezelfde tekst als @-opmerking bij het item als vangnet en geschiedenis. Geen apart
  berichtensysteem nodig.

- [x] **L6 — Alles woont bij de klant** (M) — v244, gevraagd door Jeroen 16 juli.
  Klanten, bestanden en contacten leefden op drie plekken; nu is het klantdossier de
  woonplek. Rechterkolom: Contacten (bovenaan, uitklapbaar, klik = contact bewerken,
  + = nieuw) → Afspraken → Bestanden (de echte mappenboom van de Bestanden-pagina,
  gefilterd op de klant: uitklappen, hernoemen, verwijderen, tellingen; klik op een
  bestand = voorvertoning als overlay met Laat AI lezen / Download / Dropbox) →
  Projectprijs → Notities. Hoofdmenu: knoppen Bestanden en Contacten vervangen door
  één zoek-loepje (de ⌘K-zoek dekt taken, bronnen, bestandsnamen, afspraken én
  contacten; een contact-resultaat opent nu direct het contact). De oude pagina's
  blijven in de code staan.

## Fase 7 — Klantportaal (stond al in HANDOFF §8)

- [ ] **U18 — Opmerkingen op locaties (comment-pins)** (L)
  Klant pint een opmerking op een specifieke plek/pagina van een voorstel.
- [ ] **U19 — HTML-voorstel pagina-voor-pagina** (M/L)
  Deck slide-voor-slide met opmerking + akkoord per pagina.

---

## Werkwijze per uitvoeritem
1. Claude bouwt lokaal en valideert (`new Function()` per scriptblok, `node --check` per .mjs).
2. Versiechip +1 bij elke index.html-deploy: `<span class="ver-chip">vNNN</span>` (nu v232). Zo zie je in de app of je deploy live is.
3. Deploy via de nieuwe flow (API-push voor kleine bestanden; checksum-gecontroleerde
   browser-upload voor index.html). Commit naar main altijd pas na akkoord van Jeroen.
4. Na deploy: Railway-status checken en live verifiëren.
5. Item afvinken in dit bestand + versienummer noteren.

## Deploy-lessen (browser-uploadflow)
- Bestand stagen via synthetische **drop** op de dropzone (change-event is onbetrouwbaar).
- Na stagen **wachten** tot GitHub het bestand registreert vóór de commit-klik (poll op manifest).
- GitHub's bot-detectie kan de geautomatiseerde upload blokkeren ("You can't perform that action
  at this time"). Vangnet dat werkt: Claude levert het checksum-geverifieerde bestand, Jeroen
  sleept het handmatig, Claude verifieert na de commit de sha256 op GitHub vóór iets "klaar" heet.
- [x] **U0f — /api/deploy-endpoint** (S/M) — klaar 14 juli 2026. Team-only (bearer + team_users),
  pad-whitelist, verplichte sha256-controle, commit via GitHub API met GITHUB_TOKEN als
  Railway-variable. Deployflow voortaan: Claude bouwt + valideert → POST /api/deploy vanuit de
  ingelogde app-sessie → checksum-verificatie op GitHub → Railway-status → live check.
- **Les 15 juli:** de Cowork GitHub-connector kan wél direct naar main pushen (push_files) —
  altijd eérst testen i.p.v. aannemen dat hij dicht zit. Kleine bestanden gaan voortaan direct
  via de connector; alleen index.html (760 KB) gaat via de browser-upload (file_upload op de
  GitHub-uploadpagina — werkt geautomatiseerd, 15 juli bewezen) of /api/deploy.
