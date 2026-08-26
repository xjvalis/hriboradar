-- Přejmenování rostou_* tabulek na hriboradar_* v rámci rebrandingu appky
-- na "Hřiboradar". Spustit v Supabase SQL Editoru PŘED nasazením nového
-- kódu (kód po tomto commitu už čte/zapisuje jen hriboradar_* jména - viz
-- .from("hriboradar_...") volání v api/, lib/, mobile/src/).
--
-- Bezpečné spustit i VÍCKRÁT (idempotentní) a i když některé z tabulek
-- (typicky hriboradar_subscriptions - novinka z předplatného, kterou jste
-- možná nikdy nevytvořil) ještě vůbec neexistují: každý blok si nejdřív
-- ověří, jestli má co dělat, než se o cokoliv pokusí. Tabulka bez staré i
-- nové varianty se prostě rovnou vytvoří načisto (create table if not
-- exists), místo aby se o ni renamovací příkaz pokoušel a spadl.
--
-- POSTUP: SQL Editor → New query → vlož celý tenhle soubor → Run.

do $$
begin
  if to_regclass('public.rostou_observations') is not null then
    alter table public.rostou_observations rename to hriboradar_observations;
  end if;
end $$;

create table if not exists public.hriboradar_observations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  date date not null,
  found boolean not null,
  species_ids text[] not null default '{}',
  note text,
  created_at timestamptz not null default now()
);
alter table public.hriboradar_observations enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hriboradar_observations' and policyname = 'Rostou insert own observations') then
    alter policy "Rostou insert own observations" on public.hriboradar_observations rename to "Hriboradar insert own observations";
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hriboradar_observations' and policyname = 'Rostou read own observations') then
    alter policy "Rostou read own observations" on public.hriboradar_observations rename to "Hriboradar read own observations";
  end if;
end $$;

drop policy if exists "Hriboradar insert own observations" on public.hriboradar_observations;
create policy "Hriboradar insert own observations" on public.hriboradar_observations
  for insert with check (auth.uid() = user_id);
drop policy if exists "Hriboradar read own observations" on public.hriboradar_observations;
create policy "Hriboradar read own observations" on public.hriboradar_observations
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.rostou_saved_locations') is not null then
    alter table public.rostou_saved_locations rename to hriboradar_saved_locations;
  end if;
end $$;

create table if not exists public.hriboradar_saved_locations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  label text not null,
  alerts_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.hriboradar_saved_locations enable row level security;

drop policy if exists "Rostou insert own saved locations" on public.hriboradar_saved_locations;
drop policy if exists "Rostou read own saved locations" on public.hriboradar_saved_locations;
drop policy if exists "Rostou update own saved locations" on public.hriboradar_saved_locations;
drop policy if exists "Rostou delete own saved locations" on public.hriboradar_saved_locations;
drop policy if exists "Hriboradar insert own saved locations" on public.hriboradar_saved_locations;
create policy "Hriboradar insert own saved locations" on public.hriboradar_saved_locations
  for insert with check (auth.uid() = user_id);
drop policy if exists "Hriboradar read own saved locations" on public.hriboradar_saved_locations;
create policy "Hriboradar read own saved locations" on public.hriboradar_saved_locations
  for select using (auth.uid() = user_id);
drop policy if exists "Hriboradar update own saved locations" on public.hriboradar_saved_locations;
create policy "Hriboradar update own saved locations" on public.hriboradar_saved_locations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Hriboradar delete own saved locations" on public.hriboradar_saved_locations;
create policy "Hriboradar delete own saved locations" on public.hriboradar_saved_locations
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.rostou_watched_species') is not null then
    alter table public.rostou_watched_species rename to hriboradar_watched_species;
  end if;
end $$;

create table if not exists public.hriboradar_watched_species (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  species_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, species_id)
);
alter table public.hriboradar_watched_species enable row level security;

drop policy if exists "Rostou insert own watched species" on public.hriboradar_watched_species;
drop policy if exists "Rostou read own watched species" on public.hriboradar_watched_species;
drop policy if exists "Rostou delete own watched species" on public.hriboradar_watched_species;
drop policy if exists "Hriboradar insert own watched species" on public.hriboradar_watched_species;
create policy "Hriboradar insert own watched species" on public.hriboradar_watched_species
  for insert with check (auth.uid() = user_id);
drop policy if exists "Hriboradar read own watched species" on public.hriboradar_watched_species;
create policy "Hriboradar read own watched species" on public.hriboradar_watched_species
  for select using (auth.uid() = user_id);
drop policy if exists "Hriboradar delete own watched species" on public.hriboradar_watched_species;
create policy "Hriboradar delete own watched species" on public.hriboradar_watched_species
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.rostou_notifications') is not null then
    alter table public.rostou_notifications rename to hriboradar_notifications;
  end if;
end $$;

create table if not exists public.hriboradar_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dedupe_key text not null,
  kind text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
alter table public.hriboradar_notifications enable row level security;

drop policy if exists "Rostou insert own notifications" on public.hriboradar_notifications;
drop policy if exists "Rostou read own notifications" on public.hriboradar_notifications;
drop policy if exists "Rostou update own notifications" on public.hriboradar_notifications;
drop policy if exists "Hriboradar insert own notifications" on public.hriboradar_notifications;
create policy "Hriboradar insert own notifications" on public.hriboradar_notifications
  for insert with check (auth.uid() = user_id);
drop policy if exists "Hriboradar read own notifications" on public.hriboradar_notifications;
create policy "Hriboradar read own notifications" on public.hriboradar_notifications
  for select using (auth.uid() = user_id);
drop policy if exists "Hriboradar update own notifications" on public.hriboradar_notifications;
create policy "Hriboradar update own notifications" on public.hriboradar_notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.rostou_feedback') is not null then
    alter table public.rostou_feedback rename to hriboradar_feedback;
  end if;
end $$;

create table if not exists public.hriboradar_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  species_id text not null,
  lat double precision not null,
  lon double precision not null,
  grid_lat double precision generated always as (round(lat::numeric, 1)::double precision) stored,
  grid_lon double precision generated always as (round(lon::numeric, 1)::double precision) stored,
  target_date date not null,
  observed_at date not null,
  found boolean not null,
  quantity_bucket text check (quantity_bucket in ('few', 'basket', 'lots')),
  predicted_probability integer not null check (predicted_probability between 0 and 100),
  factors jsonb not null,
  model_version text not null,
  created_at timestamptz not null default now(),
  unique (user_id, species_id, lat, lon, target_date)
);
alter table public.hriboradar_feedback enable row level security;

drop policy if exists "Rostou insert own feedback" on public.hriboradar_feedback;
drop policy if exists "Rostou update own feedback" on public.hriboradar_feedback;
drop policy if exists "Rostou read own feedback" on public.hriboradar_feedback;
drop policy if exists "Hriboradar insert own feedback" on public.hriboradar_feedback;
create policy "Hriboradar insert own feedback" on public.hriboradar_feedback
  for insert with check (auth.uid() = user_id);
drop policy if exists "Hriboradar update own feedback" on public.hriboradar_feedback;
create policy "Hriboradar update own feedback" on public.hriboradar_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Hriboradar read own feedback" on public.hriboradar_feedback;
create policy "Hriboradar read own feedback" on public.hriboradar_feedback
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.rostou_calibration_stats') is not null then
    alter table public.rostou_calibration_stats rename to hriboradar_calibration_stats;
  end if;
end $$;

create table if not exists public.hriboradar_calibration_stats (
  species_id text not null,
  probability_bucket integer not null,
  model_version text not null,
  n integer not null,
  successes integer not null,
  calibrated_probability real not null,
  brier_score real,
  global_n integer not null,
  global_successes integer not null,
  updated_at timestamptz not null default now(),
  primary key (species_id, probability_bucket, model_version)
);
alter table public.hriboradar_calibration_stats enable row level security;

drop policy if exists "Rostou read calibration stats" on public.hriboradar_calibration_stats;
drop policy if exists "Hriboradar read calibration stats" on public.hriboradar_calibration_stats;
create policy "Hriboradar read calibration stats" on public.hriboradar_calibration_stats
  for select using (true);

-- ---------------------------------------------------------------------
-- hriboradar_subscriptions is brand new (added alongside Hřiboradar Plus,
-- after the last time most people ran this schema) - there's usually no
-- "rostou_subscriptions" to rename at all, which is exactly what caused
-- the "relation does not exist" error: the old script tried to rename a
-- policy on a table that was never created. This just creates it fresh.

do $$
begin
  if to_regclass('public.rostou_subscriptions') is not null then
    alter table public.rostou_subscriptions rename to hriboradar_subscriptions;
  end if;
end $$;

create table if not exists public.hriboradar_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revenuecat_customer_id text,
  status text not null default 'none', -- none | active | trial | canceled | expired | billing_issue
  product_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.hriboradar_subscriptions enable row level security;

drop policy if exists "Rostou read own subscription" on public.hriboradar_subscriptions;
drop policy if exists "Hriboradar read own subscription" on public.hriboradar_subscriptions;
create policy "Hriboradar read own subscription" on public.hriboradar_subscriptions
  for select using (auth.uid() = user_id);
