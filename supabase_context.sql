-- Begeister: AI-context (vaste achtergrondinfo voor de AI)
-- keys: 'begeister' (gedeeld), 'jeroen', 'marlon'
create table if not exists app_context (
  key        text primary key,
  body       text,
  updated_at timestamptz default now()
);
alter table app_context disable row level security;
