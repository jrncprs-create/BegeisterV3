# Klantportaal — plan & opzet (concept, nog niet gebouwd)

Een aparte, afgeschermde omgeving per klant met eigen login, waarin wij een debrief +
deliverables klaarzetten, de klant reageert en akkoord geeft (= opdrachtbevestiging), en
daarna zelf spullen aanlevert. Dit document is de blauwdruk om op af te tekenen vóór we bouwen.

## Afgestemde keuzes
- **Inloggen:** e-mail + wachtwoord (via Supabase Auth — regelt wachtwoordopslag, sessies en account-mails zelf).
- **Scope:** per klant (één omgeving met al zijn projecten).
- **Financieel:** offerte met posten (regels → subtotaal → btw → totaal). Nooit inkoop of marge.
- **Omvang eerste release:** de volledige set (debrief, offerte, reacties, akkoord, uploads, takenlijst, meldingen).

## De hoofd-flow (briefing → akkoord → uitvoering)
1. **Briefing van de klant** komt bij ons binnen (mondeling of anders) — buiten het portaal.
2. **Debrief (wij):** opent persoonlijk als vervolg op het gesprek — *"We hebben elkaar gesproken op [datum], en zo hebben wij het begrepen — klopt dit?"* — gevolgd door de kern: een **deliverables-lijst**. Dit is het startpunt in het portaal.
3. **Klant checkt:** plaatst opmerkingen, corrigeert/vult aan waar wij het mis hadden.
4. **Akkoord op de debrief = opdrachtbevestiging:** vastgelegd moment (wie + wanneer) met een momentopname (debrief + deliverables + offerte). Status verspringt, wij krijgen een melding.
5. **Aanleveringen (klant):** de klant levert aan wat wij nodig hebben — budget, data, hoeveelheden, bestanden, bevestigingen.

### Twee spiegellijsten
- **Deliverables** = wat *wij* leveren voor het afgesproken bedrag (onze kant).
- **Aanleveringen** = wat de *klant* aan óns geeft (hun kant): budget, data, hoeveelheden, bestanden, bevestigingen. In het NL een mooi paar: Opleveringen ↔ Aanleveringen.

Een aanlevering is niet altijd een bestand. Elk item is **getypeerd** — bedrag/budget, getal/hoeveelheid, bevestiging (ja/akkoord), bestand of tekst — met een **status** (open / aangeleverd), zodat de klant weet wát hij moet geven en wij zien wat nog mist.

De deliverables-lijst is het hart van de debrief (toets of we het goed begrepen, haakt aan de offerte-posten); de aanleveringen zijn de tegenhanger die de klant na akkoord invult.

## Architectuur & beveiliging
- **Teamapp blijft ongemoeid.** Het portaal wordt een losse, lichte pagina op `app.begeister.nl/portaal` in dezelfde donkere, minimalistische stijl (per klant een accentkleur uit `projects.color`).
- **Geen open data richting klanten.** Het portaal haalt data niet rechtstreeks uit Supabase, maar via nieuwe server-endpoints (`/api/portal-*`) die met de service-role draaien. Elk verzoek stuurt de Supabase-sessie mee; de server bepaalt via een koppeltabel welke klant erbij hoort en geeft alleen díe klant z'n data terug. Alle toegangscontrole op één plek.
- Past direct op GitHub→Railway (enkele `.mjs`-endpoints erbij) en op de PWA/service-worker-opzet.

## Datamodel — nieuw of uitgebreid
Hergebruikt bestaand: `projects`, `files`, `comments`, `appointments`.

Nieuw / aangepast:
- `client_users` — koppelt een Supabase-Auth-gebruiker aan een `client`.
- `debriefs` — onze debrief per project (tekst/opmaak) + status (concept / gedeeld / akkoord).
- `deliverables` — wat wij leveren voor het afgesproken bedrag: regels per debrief/project (omschrijving, evt. gekoppeld aan offerte-post).
- `quote_lines` — offerte-posten per project (label, aantal, stukprijs, btw). Losgekoppeld van interne inkoop, zodat marge niet kan uitlekken.
- `approvals` — akkoord-registratie: wie, wanneer, en een momentopname (snapshot/hash) van wat is goedgekeurd. Dit is de opdrachtbevestiging.
- `aanleveringen` — wat de klant aan ons levert: getypeerde regels per project (soort: bedrag / hoeveelheid / bevestiging / bestand / tekst), met waarde/antwoord, status (open / aangeleverd) en evt. bestanden via bestaande `files`.
- `files` krijgt een `visible_to_client`-vlag (wij bepalen wat zichtbaar is).
- `comments` krijgt een klant-auteur + "zichtbaar in portaal", zodat interne @mention-opmerkingen en klant-reacties gescheiden blijven.

## Wat wij doen (teamkant)
Een "Klantportaal"-paneel per klant in de teamapp: één klant-login aanmaken (wij zetten e-mail + wachtwoord en geven die door aan de klant; klant kan het wachtwoord daarna zelf wijzigen — geen mailinfra nodig); de debrief + deliverables opstellen; offerte-posten invullen; bestanden aanvinken als zichtbaar; de aanleveringen samenstellen; publiceren. Klant-reacties, -uploads en het akkoord komen binnen als push (kanaal bestaat al).

## Wat de klant ziet (portaal)
Login → home met zijn project(en) → per project: de **debrief met deliverables** (met reactie-draadje en akkoord-knop), de **offerte met posten**, de vrijgegeven **documenten/presentaties** (bestaande viewer), een **totaalplaatje/status**, en zijn **aanleveringen** (getypeerde velden: bedrag, hoeveelheid, bevestiging, bestand, tekst).

## Akkoord = opdrachtbevestiging (aandachtspunt)
Omdat het akkoord meteen de opdracht bevestigt, moet het "hard" zijn: bij akkoord wordt de goedgekeurde debrief/offerte bevroren met een duidelijke **slotstatus** die de klant ziet, met datum en momentopname. Wij kunnen 'm indien nodig heropenen voor een nieuwe ronde. De vastgelegde registratie in de app is de opdrachtbevestiging — geen aparte PDF.

## Notificaties (beide kanten)
- Klant → team: via bestaande web-push (nieuwe reactie, upload, akkoord).
- Team → klant: via PWA-push (klant installeert het portaal als app en zet meldingen aan) + in-portaal "nieuw"-markeringen. Geen e-mail/mailprovider.

## Rechten
Klant ziet uitsluitend zijn eigen klant-data, alleen wat wij vrijgeven, en nooit inkoop, marge of andere klanten. Server-side afgedwongen.

## Voorgestelde bouwvolgorde
1. Fundering: `client_users` + Supabase Auth aan, `/portaal`-pagina met login, `portal-data`-endpoint (klant ziet projecten + vrijgegeven docs).
2. Debrief + deliverables (team-invoer + klant-weergave).
3. Reacties in het portaal (hergebruik `comments`) + push naar team.
4. Akkoord = opdrachtbevestiging (`approvals` + snapshot + statuswissel + melding).
5. Offerte met posten (`quote_lines`).
6. Aanleveringen + uploads (`aanleveringen` + `files`).
7. Team→klant-meldingen via PWA-push + in-portaal-markeringen.
8. Team-paneel afmaken (uitnodigen, vrijgeven, publiceren).

Per stap te deployen en te testen, ook al is de einddoelstelling de volledige set.

## Vastgestelde keuzes
1. **Na akkoord op slot.** De goedgekeurde debrief + offerte worden bevroren met een duidelijke **slotstatus** die de klant ziet. Wij (team) kunnen 'm indien nodig weer openzetten voor een nieuwe ronde.
2. **Geen PDF.** De vastgelegde registratie in de app (wie/wanneer/snapshot) is de opdrachtbevestiging.
3. **Reageren op de hele debrief**, niet per los onderdeel — geen wissewasjes.
4. **Klant-meldingen alleen via PWA-push** (+ in-portaal "nieuw"-markeringen). Geen mailprovider.
5. **Eén login per klant, niet persoonsgebonden.** Iedereen bij de klant deelt dezelfde login; een akkoord wordt vastgelegd namens de klant (het account), niet per persoon.
