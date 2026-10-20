-- Terugdraaiscript: herstelt de policies zoals ze waren op 10 juli 2026, vlak vóór de
-- team_users-migratie. Alleen draaien als de teamapp na de migratie niets meer kan zien.
-- LET OP: dit zet het datalek terug. Gebruik het om de app werkend te krijgen, en fix
-- daarna de is_team()-check.

begin;

drop policy if exists team_all on public.projects;
drop policy if exists team_all on public.items;
drop policy if exists team_all on public.project_board;
drop policy if exists team_all on public.sources;
drop policy if exists team_all on public.insp_items;
drop policy if exists team_all on public.insp_boards;
drop policy if exists team_all on public.files;
drop policy if exists team_all on public.contacts;
drop policy if exists team_all on public.appointments;
drop policy if exists team_all on public.folders;
drop policy if exists team_all on public.documents;
drop policy if exists team_all on public.attachments;
drop policy if exists team_all on public.push_subs;
drop policy if exists team_all on public.comments;
drop policy if exists team_all on public.app_context;
drop policy if exists "intake team read"  on storage.objects;
drop policy if exists "intake team write" on storage.objects;

-- RLS weer uit waar hij uit stond
alter table public.files       disable row level security;
alter table public.contacts    disable row level security;
alter table public.folders     disable row level security;
alter table public.app_context disable row level security;
alter table public.usage       disable row level security;

-- authenticated-policies terug
create policy "auth read"  on public.projects      for select using (auth.role() = 'authenticated');
create policy "auth write" on public.projects      for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read"  on public.items         for select using (auth.role() = 'authenticated');
create policy "auth write" on public.items         for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read"  on public.project_board for select using (auth.role() = 'authenticated');
create policy "auth write" on public.project_board for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read"  on public.sources       for select using (auth.role() = 'authenticated');
create policy "auth write" on public.sources       for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read"  on public.attachments   for select using (auth.role() = 'authenticated');
create policy "auth write" on public.attachments   for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "ii read"    on public.insp_items    for select using (auth.role() = 'authenticated');
create policy "ii write"   on public.insp_items    for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "ib read"    on public.insp_boards   for select using (auth.role() = 'authenticated');
create policy "ib write"   on public.insp_boards   for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- open policies terug (dit is precies wat er mis mee was)
create policy "documents read"    on public.documents    for select using (true);
create policy "documents write"   on public.documents    for insert with check (true);
create policy "documents update"  on public.documents    for update using (true) with check (true);
create policy "documents delete"  on public.documents    for delete using (true);
create policy "appointments read"   on public.appointments for select using (true);
create policy "appointments write"  on public.appointments for insert with check (true);
create policy "appointments update" on public.appointments for update using (true) with check (true);
create policy "appointments delete" on public.appointments for delete using (true);
create policy comments_all on public.comments for all to anon, authenticated using (true) with check (true);
create policy "auth all push_subs" on public.push_subs for all to authenticated using (true) with check (true);

create policy "intake read"  on storage.objects for select using (bucket_id = 'intake' and auth.role() = 'authenticated');
create policy "intake write" on storage.objects for insert to authenticated with check (bucket_id = 'intake');

commit;
