-- Afspraken (bel / fysieke ontmoetingen met datum + exacte tijd)
-- Plak dit één keer in de Supabase SQL-editor en klik Run.

create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete set null,
  title       text not null,
  owner       text,                              -- 'Jeroen' | 'Marlon' | null
  contact     text,                              -- met wie (extern)
  kind        text not null default 'fysiek',    -- 'bel' | 'fysiek'
  location    text,                              -- adres / online-link / 'telefonisch'
  date        date not null,                     -- dag van de afspraak
  start_time  time,                              -- exacte begintijd
  end_time    time,                              -- optionele eindtijd
  note        text,
  created_at  timestamptz default now()
);

create index if not exists appointments_date_idx on public.appointments (date);
create index if not exists appointments_project_idx on public.appointments (project_id);

-- RLS: zelfde permissieve patroon als de rest van de app (client gebruikt de publishable key)
alter table public.appointments enable row level security;

drop policy if exists "appointments read"   on public.appointments;
drop policy if exists "appointments write"  on public.appointments;
drop policy if exists "appointments update" on public.appointments;
drop policy if exists "appointments delete" on public.appointments;

create policy "appointments read"   on public.appointments for select using (true);
create policy "appointments write"  on public.appointments for insert with check (true);
create policy "appointments update" on public.appointments for update using (true) with check (true);
create policy "appointments delete" on public.appointments for delete using (true);
