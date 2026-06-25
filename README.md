# Begeister Workflow

AI-first intake en gedeelde actielijst voor Begeister. Berichten (mail, doorgestuurde
WhatsApp, voicenotes) komen binnen op één adres, blijven **origineel** bewaard, en Claude
haalt er gestructureerde actiepunten uit. Jeroen en Marlon delen dezelfde, altijd-actuele
interface, met een AI-wachter die op deadlines let.

## Architectuur

```
intake@begeister.nl (cloud86, IMAP)
        │  elke 5 min
        ▼
  intake-poller  ──►  Supabase
  (Vercel cron)        ├─ sources      (origineel bericht, woord voor woord)
        │              ├─ attachments  (Storage bucket "intake")
        │              └─ items        (actiepunten, via Claude)
        ▼
   Claude (Anthropic) — structureert het bericht
        │
        ▼
  Web-app (Next.js op Vercel) — Taken · Agenda · Bronnen · Klanten   ← volgende milestone
```

Het huidige **prototype** van de interface staat in `prototype/index.html` (lokaal,
in de browser). De productie-web-app is de volgende stap; de database hieronder is de basis.

## Wat staat er al

- `supabase/schema.sql` — database (klanten, projecten, bronnen, bijlagen, actiepunten)
- `intake/poller.mjs` — leest de mailbox, slaat origineel op, roept Claude aan
- `intake/extract.mjs` — Claude-extractie van actiepunten
- `api/intake.mjs` + `vercel.json` — cron-endpoint (elke 5 min)
- `.env.example` — alle benodigde geheimen

## Setup (eenmalig)

1. **Supabase-project** aanmaken op supabase.com. Open de SQL Editor en plak
   `supabase/schema.sql`, voer uit. Maak daarna in Storage een bucket **`intake`** (private).
2. **Anthropic API-key** aanmaken op console.anthropic.com.
3. **GitHub**: push deze map naar een nieuwe repo.
4. **Vercel**: importeer de repo. Zet onder *Settings → Environment Variables* alle
   waarden uit `.env.example` (echte waarden, niet de voorbeelden). Vercel pikt
   `vercel.json` op en draait de cron automatisch.
5. **Intake-mailbox**: al gemaakt in Plesk → `intake@begeister.nl`, IMAP `begeister.nl:993` (SSL).

> Belangrijke geheimen (`SUPABASE_SERVICE_ROLE_KEY`, `IMAP_PASSWORD`, `ANTHROPIC_API_KEY`)
> staan **alleen** server-side in Vercel — nooit in de browser of in Git.

## Lokaal testen

```bash
npm install
cp .env.example .env      # vul je eigen waarden in
npm run intake:once       # leest de mailbox één keer uit
```

Stuur een testmail naar `intake@begeister.nl`, draai het commando, en controleer in
Supabase de tabellen `sources` en `items`.

## Volgende stappen

- Web-app (Next.js) op basis van het prototype, met login (magic-link) voor Jeroen & Marlon.
- AI-wachter als dagelijkse cron die per mail/in-app seint bij dreigende deadlines.
- Fase 2: voicenote-transcriptie en een eigen WhatsApp-nummer als intake-kanaal.
