# Begeister — Vervolg-/overdrachtsdocument

_Laatst bijgewerkt: 1 juli 2026 · huidige app-versie: **v105**_

Dit document laat je (of een nieuwe chat) naadloos verdergaan zonder verlies van context, geschiedenis of logica. Plak het begin van een nieuwe chat, of laat het lezen.

---

## 0. Perfecte startprompt (kopieer dit in een nieuwe chat)

> Je werkt verder aan **Begeister** — een gedeelde AI-werkplek (PWA) voor Jeroen (designer, jeroen@begeister.nl) en Marlon (eventmanager); domein licht/decor/events. De projectmap is gekoppeld.
>
> **Lees eerst `VERVOLG.md` in de projectmap volledig** — daarin staan de stack, de deploy-workflow, de lopende status en de openstaande taken. Verzin niets; check de repo, `public/index.html` en de Railway-logs waar nodig.
>
> **Werkwijze (verplicht):** beknopt Nederlands; Jeroen is designer, geen bouwvakker (verwelkom detailwerk, klink niet geïrriteerd, geen eindeloze losse puntjes). Vóór elke deploy: valideer de `<script>`-blokken in `index.html` (zie het node-commando in VERVOLG.md), **hoog de versie-chip op**, deploy via de **GitHub-web-upload** (Chrome MCP → `upload/main/<map>`), en **werk `VERVOLG.md` bij** bij elke mijlpaal.
>
> **Begin met:** (1) bevestig kort de huidige app-versie (versie-chip) en of er nog een Anthropic-storing loopt (Railway-logs: "Premature close"); (2) vat de eerstvolgende openstaande taak uit VERVOLG.md samen; (3) vraag mij waar ik verder wil.

## 0b. Onderhoud van dit document (geautomatiseerd)

- **Laag 1 — vaste gewoonte (rijke inhoud):** de assistent werkt `VERVOLG.md` bij als vaste stap in de deploy-routine (versie ophogen → doc bijwerken → deployen). Zo blijven ook keuzes/valkuilen/waaroms vastgelegd.
- **Laag 2 — geplande taak (mechanisch vangnet):** een dagelijkse routine leest de laatste GitHub-commits + de huidige versie-chip en ververst automatisch de versie, de versiegeschiedenis en de datum in dit document. Deployt/pusht niets.

---

## 1. Wat is Begeister?

Een gedeelde AI-werkplek (PWA) voor **Jeroen** (designer, jeroen@begeister.nl) en **Marlon** (eventmanager). Domein: licht, decor & event-productie. De app vangt losse input (mail, WhatsApp, gesleepte bestanden, geplakte tekst) op, laat AI er actiepunten/afspraken uit halen, en organiseert alles per klant/project.

- **Live:** https://app.begeister.nl
- **Installatie:** als PWA (macOS desktop-app + iPhone). Cache loopt ~1 versie achter → na een deploy **herladen**.

## 2. Stack & architectuur

- **Frontend:** één groot bestand `public/index.html` (~470 KB, vanilla JS, geen build-stap). Alle UI, state en logica zit hierin.
- **Backend:** Express `server.mjs` + losse handlers in `api/*.mjs`, draait op **Railway**.
- **Database:** Supabase, project-ref **`rwevsqwvgqbzypaudzuj`** (Supabase MCP beschikbaar: `execute_sql`, `apply_migration`, `list_projects`).
- **AI:** Anthropic API. Chat = `claude-sonnet-4-6`; kleine taken/bestellijst = `claude-haiku-4-5-20251001`.
- **Repo:** GitHub `jrncprs-create/BegeisterV3` (privé). Railway auto-deployt bij elke push naar `main`.

## 3. Deploy-workflow (BELANGRIJK — lees dit)

De **lokale git-checkout loopt ~159 commits achter** op origin en de sandbox heeft **geen push-rechten**. Alle deploys gaan daarom via **GitHub's web-upload**, aangestuurd met de Chrome MCP:

1. `navigate` naar `https://github.com/jrncprs-create/BegeisterV3/upload/main/<map>` (bv. `public`, `api`, `intake`, `lib`).
2. `find` het "Choose your files"-input (meestal `ref_143`) → `file_upload` met het absolute pad `/Users/jeroencuypers/Projects/BegeisterV3/...`.
3. Scroll omlaag, klik het commit-berichtveld, typ een bericht, klik **Commit changes**.
   - **Let op de knoppositie:** bij een bericht **≥ ~50 tekens** verschijnt een "ProTip"-regel en zakt de knop → klik op **y≈668**. Bij een **korter** bericht staat de knop op **y≈646**.
4. Elke map = een aparte commit (de web-uploader plaatst bestanden in de map uit de URL).

**Voor elke deploy:** hoog de versie-chip op in `public/index.html` (`<span class="ver-chip" ...>vN</span>`) zodat je live kunt zien of de nieuwe versie geladen is.

## 4. Validatie vóór deploy (altijd doen)

Draai in de sandbox (bash), map-mapping: `/Users/jeroencuypers/Projects/BegeisterV3` → `/sessions/<...>/mnt/BegeisterV3`:

```bash
node -e '
const fs=require("fs");const h=fs.readFileSync("public/index.html","utf8");
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;let m,i=0,bad=0;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){bad++;console.log("ERR#"+i,e.message);}}
console.log(bad?("FAIL "+bad):("ALL SCRIPTS OK ("+i+")"));'
```

Voor backend-bestanden: `node --check api/xxx.mjs`.

## 5. Railway-logs uitlezen (voor debuggen)

Via de Railway MCP: project `27b6aae8-8811-4ffc-9e0b-038f29edd0dd`, service `e2e28683-dbbe-44bf-b93d-b398820b9197`, env `4ed261df-9bb2-4f63-b074-b83eb55893c7`. `get-logs` met `types:["deploy"]` en een `filter`.

---

## 6. LOPEND PROBLEEM: Anthropic API-storing

Op 1 juli rond 08:41 UTC faalde de Anthropic-API kort met **`Invalid response body ... Premature close`** — een netwerk/uptime-hapering bij Anthropic, **niet** tokens/credits en **niet** de app. Dit raakt álle AI-functies: chat, bestellijst-AI, drop-intake, mail, WhatsApp.

**Update 1 juli (later):** lijkt een kórte hapering van die ochtend geweest — sindsdien geen nieuwe `Premature close` in de Railway-logs, en status.claude.com meldt vandaag "No incidents / all operational". Voor de zekerheid bij twijfel een echte AI-call triggeren (chat) en de logs checken.

**Mitigatie al gebouwd:** `lib/airetry.mjs` — retry-wrapper (3 pogingen, backoff) op alle Anthropic-calls in `api/chat.mjs`, `api/bestellijst.mjs`, `api/readdrop.mjs`, `intake/extract.mjs`, `intake/whatsapp.mjs`. Herstelt tijdelijke haperingen automatisch.

**Actie zodra AI weer draait:** bevestigen dat chat + intake weer doorlopen (check Railway-logs op "Premature close").

---

## 7. Grote lijn deze sessie: Amazon-/bestellijst-flow

Doel: een Amazon-winkelwagen/verlanglijst in de **Bestellijst** van een project krijgen, met werkende links, prijzen, aantallen en thumbnails — óók tijdens de AI-storing.

**Waar het landde (v104):**
- **Plakken zonder AI:** de ✱ "lijst"-knop opent een plakvak. Bij plakken vangt de app óók de **klembord-HTML** op (`getData('text/html')`) — die bevat de `<a href>`-links én `<img>`-thumbnails die platte textarea-tekst mist. `_htmlToLinkText()` zet die HTML om naar tekst-met-links; `_parsePastedList()` maakt er inkoopregels van. Geen AI nodig.
- **Parser-details:** dubbele links per product (foto-link + titel-link) worden samengevoegd op ASIN (geen lege "Artikel"-rijen); subtotaal/totaal wordt genegeerd; prijs-fallback koppelt losse €-bedragen op volgorde; namen worden ingekort (`_shortName`, knip op komma/streepje); Amazon-URL's worden gecanonicaliseerd naar `/dp/<ASIN>`.
- **Weergave:** thumbnail (36px) + korte naam + klikbare link (echte productlink, anders Google-zoeklink op de naam). Bij aantal > 1: prijs-per-stuk in het invoervak + subregel "2 × €x = €totaal"; totaal onderaan telt stuk × aantal.
- **"Bestel alles bij Amazon"-knop: VERWIJDERD** in v104. Amazon's add-to-cart-URL (`/gp/aws/cart/add.html?ASIN.1=…`) is in 2026 onbetrouwbaar (404's). Op verzoek eruit gehaald.
- **DB:** kolom `image text` toegevoegd aan `project_board` (migratie `add_image_to_project_board`).

**Belangrijke kanttekening:** het plakvak in de app is een `<textarea>` (platte tekst). De links/thumbnails komen alleen mee via de **HTML-klembord-capture** bij het plak-event. Werkt op desktop Chrome/Safari; op iPhone omslachtiger.

**Nog te verifiëren (zodra v104 live is):** oude rommelige bestellijst-data leegmaken (prullenbak-icoon) en opnieuw plakken; checken of thumbnails netjes laden en of prijzen/aantallen kloppen.

## 8. Nieuw in deze sessie: klembord-knop in het menu (v103)

Menu-knop **"📋 Plakken"** (id `clipBtn`). Klik → leest je klembord (probeert `navigator.clipboard.read()` voor HTML, anders een plakvak-modal) → zet HTML om naar tekst-met-links → schuift het als **bron** de bestaande drop-intake in (`handleDroppedFiles` → source + `/api/readdrop` → AI-actiepunten → review met klant/project-dropdowns). Werkt overal in de app.

## 9. Versiegeschiedenis deze sessie (kort)

- **v96** bestellijst-feedback bij 0 items (niet meer stil dichtklappen)
- **v97** splash-tekst fade-only (iOS-render-spook weg: `textReveal` opacity-only)
- **v98** bestellijst-item zonder link → Google-zoeklink op naam
- **v99** "Bestel alles bij Amazon" (later weer verwijderd)
- **v100** winkelwagen mét links lokaal parsen
- **v101** klembord-HTML lezen bij plakken (links + thumbnails-basis)
- **v103** klembord-knop in menu + dubbel-link fix + subtotaal-guard
- **v104** thumbnails, korte namen, prijs/stuk + "2× = totaal", "Bestel alles"-knop weg
- **v105** échte dictafoon (opname i.p.v. live-tekst): rode mic + live waveform + meelopende tijd, géén tekst tijdens inspreken; versturen → `/api/transcribe` (Groq Whisper) → transcript + taak-suggesties → review in "In afwachting"
- Backend: `lib/airetry.mjs` toegevoegd + ingezet in chat/bestellijst/readdrop/extract/whatsapp
- Backend: `api/transcribe.mjs` toegevoegd (Groq Whisper `whisper-large-v3-turbo`) + gemount in `server.mjs`

### Spraak-dictafoon (v105) — details
- **Frontend** (`public/index.html`): `voiceMode()` volledig herschreven — `MediaRecorder` + Web Audio `AnalyserNode` voor de live waveform. Overlay `#voiceRec` (paneel `#vrPanel`), knoppen `vrCancel` / `vrTogglePause` / `vrStop(send)`. Bij versturen → `_vrSend()` → `/api/transcribe`. Review-modal `#voiceReview`: `vrReviewOpen`, `vrAddTaskLine`, `vrSaveReview` (bewerkt transcript op de bron + aangevinkte regels als `items` status `wait`).
- **Backend** (`api/transcribe.mjs`): audio (base64) → opslaan in Supabase `intake`-bucket + `sources`-rij (channel `voice`) → Groq-transcriptie → `extractItems()` voor taak-suggesties → alles terug naar de app.
- **Vereist:** `GROQ_API_KEY` als Railway-variable (console.groq.com). Zonder key werkt opnemen wél, maar komt er een nette melding i.p.v. transcript. Claude/Anthropic kan géén audio transcriberen — daarom een aparte STT-dienst.
- **Nog te verifiëren (zodra v105 live is):** GROQ_API_KEY zetten, dan op desktop + iPhone inspreken → transcript + taak-suggesties → splitsen in "In afwachting". Waveform/tijd checken.

## 10. Openstaande taken / roadmap

- **Spraak-dictafoon v105 live verifiëren** — eerst `GROQ_API_KEY` in Railway zetten, dan opnemen op desktop + iPhone testen (transcript, taak-suggesties, "In afwachting") — eerstvolgende.
- **Bestellijst v104 live verifiëren** (thumbnails, prijzen, aantallen).
- **WhatsApp-voicenotes transcriberen** (nu alleen de in-app dictafoon): `intake/whatsapp.mjs` handelt `audio`/`voice` niet af (media wordt niet gedownload). Later dezelfde Groq-route eronder hangen.
- **AI-verkorte namen** zodra de AI-storing voorbij is (nu lokaal ingekort).
- **#19** Bronnen + Archief samenvoegen; Archief uit menu; 3-daagse prullenbak.
- **#20** Google koppelen: Google Docs in-app lezen/voorvertonen (vereist Google Cloud OAuth-credentials van Jeroen).
- **#21** Klant-kleur consequent overal doorvoeren.
- **#14** Amazon-link → "In afwachting" inkoop-kaart → toewijzen → ✓ naar inkoop.
- **#4** Mobiel: invoervak pixel-perfect mergen met iOS-toetsenbordbalk.
- **Pagina-voor-pagina walkthrough** voortzetten volgens het "Klanten"-stramien (Financiën, Bestanden, Contacten, Bronnen).

## 11. Belangrijke functies/plekken in `public/index.html`

- Bestellijst-parser: `_parsePastedList`, `_htmlToLinkText`, `_cleanProductUrl`, `_dedupTitle`, `_shortName`
- Plak-modal bestellijst: `pbInkPaste` (vangt klembord-HTML, lokale parse → anders `/api/bestellijst`)
- Item-render: `inkRow` (thumbnail + naam + prijs/stuk + subregel); sectie `secBestel`
- Klembord-menu-knop: `pasteAsSource`, `_ingestPasted`, `_pasteSourceModal`
- Drop-intake: `handleDroppedFiles`, `_dropProcess`, review-UI `_dzShowSummary`/`_dzSave`
- Projectbord render: `_renderProjBoard` (rendert inline in kolommen, geen overlays)

## 12. Tone & werkwijze (belangrijk voor de samenwerking)

- Jeroen is **designer, geen bouwvakker** — verwelkom detailwerk, klink niet geïrriteerd, geen eindeloze losse puntjes.
- Antwoord **beknopt en direct** (voorkeur van Jeroen), Nederlands.
- **Bevestig side-effect-acties** en bouw stap-voor-stap; valideer scripts vóór elke deploy; hoog de versie-chip op.
