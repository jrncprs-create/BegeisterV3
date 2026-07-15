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

-- ===== Fase 1-afronding (15 juli 2026) =====
-- U2: wachten-op-bewaking (migratie `u2_wait_sinds`). "Op wie" = bestaand contact-veld.
alter table public.items add column if not exists wait_sinds timestamptz;
create or replace function public.items_wait_sinds() returns trigger
language plpgsql as $$
begin
  if new.status = 'wait' then
    if (tg_op = 'INSERT') or (old.status is distinct from 'wait') then
      new.wait_sinds := coalesce(new.wait_sinds, now());
    end if;
  else
    new.wait_sinds := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_items_wait_sinds on public.items;
create trigger trg_items_wait_sinds
  before insert or update on public.items
  for each row execute function public.items_wait_sinds();
update public.items set wait_sinds = coalesce(updated_at, created_at, now())
where status = 'wait' and wait_sinds is null;

-- ===== Restant backlog (15 juli 2026) =====
-- U11b: afspraak-suggesties uit de AI-intake bij de bron (migratie `u11b_u12_appts_finstatus`)
alter table public.sources add column if not exists suggest_appts jsonb;
-- U12: status per financieel document (concept -> verstuurd -> akkoord -> betaald)
alter table public.files add column if not exists fin_status text;
alter table public.documents add column if not exists fin_status text;

-- Leestafel (15 juli, migratie `leestafel_suggest_items`): bewaarde AI-voorstellen bij een bron
alter table public.sources add column if not exists suggest_items jsonb;
