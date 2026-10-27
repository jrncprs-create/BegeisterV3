-- Herstel standaardwaarden die bij de verhuizing van Supabase naar alwaysdata (21 okt 2026) verloren gingen.
-- Uitgevoerd op cprs_begeisterwf op 27 okt 2026. Veilig opnieuw te draaien.
BEGIN;
alter table cms_gesprekken alter column geschiedenis set default '[]'::jsonb;
alter table cms_gesprekken alter column weergave set default '[]'::jsonb;
alter table cms_logboek alter column opmerkingen set default '[]'::jsonb;
alter table comments alter column mentions set default '{}'::text[];
alter table items alter column checklist set default '[]'::jsonb;
alter table lab_interesse alter column interesse set default '{}'::text[];
alter table lab_interesse alter column momenten set default '{}'::text[];
alter table loft_instellingen alter column open_punten set default '[]'::jsonb;
alter table loft_instellingen alter column status set default '{}'::jsonb;
alter table projects alter column portal_secties set default '{"taken": false, "notities": false, "afspraken": false, "bestanden": false, "voortgang": true, "omschrijving": false, "projectprijs": false}'::jsonb;
alter table tegoed_instelling alter column gemeld set default '{}'::text[];
create sequence if not exists loft_log_id_seq owned by loft_log.id;
select setval('loft_log_id_seq', coalesce((select max(id) from loft_log), 0) + 1, false);
alter table loft_log alter column id set default nextval('loft_log_id_seq'::regclass);
COMMIT;
