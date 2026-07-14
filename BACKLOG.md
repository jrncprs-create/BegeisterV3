# Begeister Workflow — Uitvoerbacklog

_Aangemaakt 14 juli 2026 · hoort bij HANDOFF.md · live versie **v235**_

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

## Fase 1 — Overzicht & dashboard

- [x] **U1 — "Vandaag"-dagoverzicht compleet** (M) — v235. Ontdekking: er bestónd al een
  dagoverzicht (zonnetje-knop rechtsboven + automatisch 1x/dag na het welkomstscherm) met
  afspraken, deadlines, wacht-op, waar-ligt-de-bal en weer. Toegevoegd: kaart "Nieuw sinds
  gisteren" (mail/WhatsApp/drops laatste 24u, klik -> Postvak). Kaart verbergt zichzelf als leeg.
- [ ] **U2 — Wachten-op-bewaking** (M)
  Taken met status "wait" krijgen "wacht op wie + sinds wanneer". Na X dagen verschijnt het item
  op het Vandaag-scherm met een voorstel-opvolgactie. Kolom `wait_op`/`wait_sinds` op `items`.
- [ ] **U3 — Pijplijn-kanban over alle projecten** (M)
  Eén bord met projecten als kaarten per fase (briefing → voorstel → productie → oplevering →
  betaald), met projectprijs op de kaart. Slepen = fase wijzigen.
- [ ] **U4 — "Heeft aandacht nodig"-signalen** (M)
  Automatische detectie: project zonder activiteit >X dagen, offerte zonder reactie >7 dagen,
  taak over deadline. Toont als signaalrij op het Vandaag-scherm. (Bouwt op U1.)

## Fase 2 — Taken & todo

- [ ] **U5 — Deadlines, herinneringen en "vandaag doen"** (M)
  Deadlineveld op taken, pushherinnering (bestaat deels), en een handmatige vandaag-selectie
  bovenop de statuskolommen.
- [ ] **U6 — Terugkerende taken** (S/M)
  Herhaalpatroon op een taak (wekelijks/maandelijks/per kwartaal, bijv. btw-aangifte). Bij
  afvinken wordt automatisch de volgende aangemaakt.
- [ ] **U7 — Bestaande losse taken hergroeperen** (S) _(stond al in HANDOFF §8)_
  Migratiescript: losse kaartjes van één bron samenvoegen tot één kaart met checklist.

## Fase 3 — Directiesecretaresse

- [ ] **U8 — Antwoordconcepten bij intake** (M)
  Bij elke intake-mail zet de AI direct een concept-antwoord klaar; jij keurt goed of past aan.
  Verzenden via mailto of (later) SMTP-koppeling.
- [ ] **U9 — Spraakmemo-transcriptie** (M)
  .m4a/.mp3-drops worden getranscribeerd (Whisper of vergelijkbaar) en gaan daarna door de
  normale AI-intake → samenvatting + actiepunten. Er staan al spraakmemo's in het archief.
- [ ] **U10 — Follow-upmachine** (M)
  Offerte verstuurd → na 7 dagen herinneringsconcept; factuur → betalingsherinnering na
  vervaldatum. Gebruikt de pijplijnstatus uit U12. (Bouwt op U2/U8.)

## Fase 4 — Agenda

- [ ] **U11 — Agenda-sync met Google/Apple Calendar** (L)
  Tweeweg-sync van `appointments` via Google Calendar API en/of CalDAV. OAuth-koppeling per
  teamlid. Grootste losse bouwsteen van deze backlog.
- [ ] **U11b — Afspraakdetectie uit intake** (S/M)
  De AI-intake herkent datum/tijd in mails en stelt naast actiepunten ook een agenda-item voor.
  Kan vóór U11 (werkt ook zonder sync).

## Fase 5 — Financiën

- [ ] **U12 — Offerte/factuur-pijplijn** (M)
  Status per financieel document: concept → verstuurd → akkoord → betaald, met openstaand saldo
  per klant en verstuurd-op-datum. Fundament voor U10.
- [ ] **U13 — Kwartaal-/jaaroverzicht** (M)
  Omzet, kosten en marge over alle projecten heen, per kwartaal en jaar, op de Financiën-pagina.
- [ ] **U14 — Boekhoudkoppeling (Moneybird / e-Boekhouden)** (L)
  Facturen en betaalstatus synchroniseren zodat niets dubbel wordt bijgehouden. Keuze pakket
  eerst met Jeroen bepalen.

## Fase 6 — Bestanden & zoeken

- [ ] **U15 — Volledig-tekst zoeken** (M/L)
  De intake leest bestanden al; sla de geëxtraheerde tekst op (kolom of aparte tabel + Postgres
  full-text index) en maak één zoekbalk over bestanden, mails en taken.
- [ ] **U16 — AI-hersortering van het bestaande archief** (M)
  Eenmalige batch: alle bestaande bestanden zonder (goede) categorie door de AI-sortering halen
  → juiste zes-map en waar mogelijk juist project. Logisch direct na U0c.
- [ ] **U17 — Wekelijkse gezondheidscheck** (S/M)
  Cronjob in server.mjs: detecteer duplicaten, wezen en rare financiële waardes; rapporteer als
  taak/melding. Automatiseert de audit van 14 juli.

## Fase 7 — Klantportaal (stond al in HANDOFF §8)

- [ ] **U18 — Opmerkingen op locaties (comment-pins)** (L)
  Klant pint een opmerking op een specifieke plek/pagina van een voorstel.
- [ ] **U19 — HTML-voorstel pagina-voor-pagina** (M/L)
  Deck slide-voor-slide met opmerking + akkoord per pagina.

---

## Werkwijze per uitvoeritem
1. Claude bouwt lokaal en valideert (`new Function()` per scriptblok, `node --check` per .mjs).
2. Versiechip +1 bij elke index.html-wijziging.
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
