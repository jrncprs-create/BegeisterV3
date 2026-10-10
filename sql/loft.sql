-- Loft Spinozastraat: kamerverhuur via Airbnb en Booking (10 okt 2026).
-- Vijf tabellen, alleen leesbaar en schrijfbaar voor jeroen@begeister.nl (RLS op e-mail).
-- De cloud-agent schrijft met de service-role; de app leest als ingelogde Jeroen.

create table if not exists loft_instellingen (
  id            text primary key default 'main',
  weekdag       numeric,            -- gastprijs doordeweeks, alles inbegrepen
  weekend       numeric,            -- gastprijs vr/za
  minimum       numeric,
  maximum       numeric,
  langverblijf_pct numeric default 10,   -- korting vanaf 4 nachten
  leeg_dagen    int default 14,          -- prijs omlaag als nog leeg zoveel dagen vooraf
  status        jsonb default '{}'::jsonb,  -- {airbnbLive, bookingLive, bookingIssues, synced}
  open_punten   jsonb default '[]'::jsonb,  -- [{who, text}]
  bijgewerkt    timestamptz default now()
);

create table if not exists loft_dagen (
  datum         date primary key,
  status        text,               -- vrij | airbnb | booking | blok
  gast          text,
  gasten        int,
  code          text,               -- bevestigingscode
  url           text,               -- link naar de reservering
  aankomst      boolean default false,
  vertrek       boolean default false,
  prijs_airbnb  numeric,            -- gastprijs die dag op Airbnb (incl. belasting)
  prijs_booking numeric,
  bijgewerkt    timestamptz default now()
);

create table if not exists loft_voorstellen (
  id            text primary key,
  soort         text not null,      -- prijs | bericht
  platform      text,               -- Airbnb | Booking | beide
  gast          text,
  datums        text,
  titel         text not null,
  detail        text,
  vraag         text,               -- oorspronkelijke tekst van de gast
  concept       text,               -- conceptantwoord of voorgestelde wijziging
  status        text default 'open',-- open | ja | nee | verzonden | uitgevoerd
  mail_id       text,               -- Gmail message-id van het gastbericht
  reply_to      text,               -- adres waar het antwoord heen moet
  onderwerp     text,
  aangemaakt    timestamptz default now(),
  besloten_op   timestamptz,
  uitgevoerd_op timestamptz,
  resultaat     text
);

create table if not exists loft_buurt (
  id            text primary key,
  naam          text,
  platform      text,
  badkamer      text,
  prijs         numeric,
  score         text,
  reviews       int,
  ik            boolean default false,
  gemeten       date
);

create table if not exists loft_log (
  id            bigserial primary key,
  tijd          timestamptz default now(),
  tekst         text not null
);

alter table loft_instellingen enable row level security;
alter table loft_dagen        enable row level security;
alter table loft_voorstellen  enable row level security;
alter table loft_buurt        enable row level security;
alter table loft_log          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['loft_instellingen','loft_dagen','loft_voorstellen','loft_buurt','loft_log'] loop
    execute format('drop policy if exists "alleen jeroen" on %I;', t);
    execute format($p$create policy "alleen jeroen" on %I for all
      using ((auth.jwt() ->> 'email') = 'jeroen@begeister.nl')
      with check ((auth.jwt() ->> 'email') = 'jeroen@begeister.nl');$p$, t);
  end loop;
end $$;
