# BegeisterV3

**Waarom:** nog invullen
**Wat:** Begeister workflow-app: AI-intake van mail/WhatsApp/voicenotes naar gedeelde actielijst voor Jeroen en Marlon
**Wanneer goed:** nog invullen

## Werkwijze
- Jeroens vaste werkwijze geldt (skill jeroen-code); regels in dit bestand gaan voor.

## Valkuilen
- **Supabase is niet meer de live database.** De app leest via db-api (`cprs.alwaysdata.net/db/wf`) uit PostgreSQL `cprs_begeisterwf` op alwaysdata. Supabase `rwevsqwvgqbzypaudzuj` is een oude kopie van 21 okt 2026; schrijf daar niets in. Controleer bij twijfel `sb.supabaseUrl` in de live app.
- **Data rechtstreeks in de live database** gaat via de alwaysdata-MCP: SQL-bestand schrijven met `bestanden_schrijf` en draaien met `database_importeer` (psql, stopt bij de eerste fout). Zet het in `BEGIN; ... COMMIT;`. Uitlezen kan door in een `do`-blok met `raise exception` het resultaat terug te geven. Ruim de tijdelijke bestanden daarna op.
- **Kolomstandaarden gingen verloren bij de verhuizing** (12 kolommen, o.a. `items.checklist` en `projects.portal_secties`), waardoor inserts zonder die velden faalden. Hersteld op 27 okt 2026 met `sql/herstel-standaardwaarden.sql`. Na een nieuwe dump/import: standaarden opnieuw vergelijken.

## Hosting
Alles draait op alwaysdata (account `cprs`), via de alwaysdata-MCP. Geen Railway, Supabase, Vercel, Cloud86 of Mac mini als server, ook niet voor nieuwe dingen of databases. Overzicht en werkwijze: `docs/HOSTING.md` in repo jrncprs-create/alwaysdata-mcp.
Dit project: app.begeister.nl en portal.begeister.nl draaien op alwaysdata, site 1089609 (code in `apps/begeister-app`), database `cprs_begeisterwf` via db-api (site 1089591, repo cprs-db-api). Testadres appnieuw.begeister.nl (site 1089605, zonder crons).
