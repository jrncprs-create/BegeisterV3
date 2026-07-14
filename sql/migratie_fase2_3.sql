-- Fase 2/3 backlog (14 juli 2026): U5 vandaag-selectie, U6 herhaalpatroon,
-- U8 antwoordconcept bij intake, U10 verstuurd-op voor voorstellen.
-- Uitgevoerd via Supabase-migratie `fase2_3_taken_reply_voorstel`.
alter table public.items add column if not exists vandaag date;      -- U5: handmatige "vandaag doen"-selectie (datum = de dag waarop hij geldt)
alter table public.items add column if not exists herhaal text;      -- U6: 'week' | 'maand' | 'kwartaal' | null
alter table public.sources add column if not exists suggest_reply text;   -- U8: AI-concept-antwoord bij een intake-mail
alter table public.files add column if not exists verstuurd_op timestamptz;      -- U10: wanneer is het voorstel naar de klant gegaan
alter table public.documents add column if not exists verstuurd_op timestamptz;  -- U10: idem voor mailbijlage-documenten

-- U10 backfill: bestaande voorstellen gelden als verstuurd op hun aanmaakdatum
update public.files set verstuurd_op = created_at where is_voorstel = true and verstuurd_op is null;
update public.documents set verstuurd_op = created_at where is_voorstel = true and verstuurd_op is null;
