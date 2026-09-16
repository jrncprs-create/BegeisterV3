# Klantportaal — beknopt overzicht

**Wat:** een aparte, afgeschermde omgeving per klant (eigen login) waar wij een debrief +
offerte klaarzetten, de klant reageert en akkoord geeft (= opdrachtbevestiging), en daarna
zelf spullen aanlevert. Zelfde stijl als de app, per klant een accentkleur.

## De flow
1. Klant brief't ons (mondeling/anders).
2. **Wij zetten de debrief klaar:** "we spraken elkaar, zo hebben wij het begrepen — klopt dit?" met een **Deliverables**-lijst (wat wij leveren voor het bedrag) + **offerte met posten**.
3. Klant **reageert/corrigeert** op de debrief.
4. Klant geeft **akkoord = opdrachtbevestiging** → gaat op slot (met slotstatus), vastgelegd in de app.
5. Klant vult zijn **Aanleveringen** in — wat hij aan ons geeft: budget, data, hoeveelheden, bestanden, bevestigingen.

## Twee spiegellijsten
- **Deliverables** = wat wij leveren.
- **Aanleveringen** = wat de klant levert (getypeerd: bedrag / hoeveelheid / bevestiging / bestand / tekst, met status open/aangeleverd).

## Afgesproken keuzes
- Inloggen met wachtwoord; **één login per klant** (niet persoonsgebonden).
- **Per klant** (alle projecten van die klant in één omgeving).
- Financieel: **offerte met posten** — nooit onze inkoop of marge.
- Na akkoord **op slot** (wij kunnen heropenen); bevestiging in de app, **geen PDF**.
- Reageren op de hele debrief, niet per wissewasje.
- Meldingen via **PWA-push** (geen e-mailprovider).
- Eerste release = **de volledige set** in één keer.

## Bouwt voort op wat er al is
Hergebruikt bestaande projecten, bestanden, opmerkingen en push. Nieuw is vooral de klant-voorkant
(`/portaal`), de login-laag en een paar server-endpoints; teamapp blijft ongemoeid.
Klantdata loopt via afgeschermde server-endpoints — klanten krijgen nooit directe database-toegang.

*(Volledig plan: KLANTPORTAAL-PLAN.md)*
