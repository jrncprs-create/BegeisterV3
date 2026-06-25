-- Begeister Workflow — database schema (Supabase / Postgres)
-- Eén projects-tabel = klant + project (sluit 1-op-1 aan op de interface).
-- Veilig opnieuw uit te voeren: dropt bestaande tabellen eerst (DB is nog leeg).

drop table if exists items cascade;
drop table if exists attachments cascade;
drop table if exists sources cascade;
drop table if exists projects cascade;
drop table if exists clients cascade;

-- KLANT + PROJECT (één regel)
create table projects (
  id          uuid primary key default gen_random_uuid(),
  client      text not null,
  project     text not null default '',
  color       text not null default '#9ca3af',
  icon        text not null default '?',
  role        text not null default '',
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

-- BRONNEN (origineel binnengekomen bericht, woord voor woord)
create table sources (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete set null,
  channel      text not null default 'email',   -- email | whatsapp | voice | paste
  sender       text,
  subject      text,
  body         text,
  summary      text,
  message_id   text unique,                      -- voorkomt dubbele verwerking
  received_at  timestamptz not null default now(),
  processed    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- BIJLAGEN (in Storage bucket "intake")
create table attachments (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references sources(id) on delete cascade,
  filename      text,
  storage_path  text,
  mime          text,
  size          integer,
  transcript    text,
  created_at    timestamptz not null default now()
);

-- ACTIEPUNTEN
create table items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  source_id   uuid references sources(id) on delete set null,
  title       text not null,
  owner       text,                              -- Jeroen | Marlon
  contact     text,                              -- extern contact (mag leeg)
  due         date,
  status      text not null default 'todo',      -- todo | doing | wait | done
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index items_project_idx on items(project_id);
create index items_due_idx     on items(due);
create index sources_proj_idx  on sources(project_id);

create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger items_touch before update on items
  for each row execute function touch_updated_at();

-- TOEGANG: alleen ingelogde gebruikers (Jeroen & Marlon)
alter table projects    enable row level security;
alter table sources     enable row level security;
alter table attachments enable row level security;
alter table items       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','sources','attachments','items'] loop
    execute format('create policy "auth read"  on %I for select using (auth.role() = ''authenticated'');', t);
    execute format('create policy "auth write" on %I for all    using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');', t);
  end loop;
end $$;

-- Beginklanten (House of Chi, BonBonVovant, Ostrica)
insert into projects (client, project, color, icon, role, sort) values
  ('House of Chi', 'Landjuweel',              '#a78bfa', 'C', 'Begeister · licht & decor · budget €5.300', 1),
  ('BonBonVovant', 'Landjuweel (met Leon)',   '#60a5fa', 'B', 'Begeister × Leon · €950 ex, incl. lantaarns', 2),
  ('Ostrica',      'incentive Athene 2027',   '#34d399', 'O', 'Begeister · incentive · €40k–€50k · vr–ma 2027', 3);
