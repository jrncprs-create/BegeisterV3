-- Begeister: tabel voor gekoppelde Dropbox-bestanden (per project of contact)
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,            -- 'project' of 'contact'
  owner_id   text not null,            -- project_id of contact_id
  name       text not null,            -- bestandsnaam
  link       text not null,            -- Dropbox preview-link
  icon       text,                     -- Dropbox icoon-URL
  bytes      bigint,
  created_at timestamptz default now()
);
create index if not exists files_owner_idx on files(owner_type, owner_id);

-- zelfde toegangsmodel als de rest van de app (anon key vanuit de frontend)
alter table files disable row level security;
