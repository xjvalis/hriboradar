-- Rostou? - Supabase schema
-- Sdílený projekt s janvalis-portfolio/Gradus (Gradus-interiery) - tabulka
-- má prefix rostou_, aby se nepotkala s ničím existujícím. Na rozdíl od
-- janvalis_* tabulek (jeden pevný admin UID smí zapisovat) tady zapisuje
-- KAŽDÝ přihlášený uživatel, ale jen svoje vlastní řádky - auth.uid() musí
-- sedět se sloupcem user_id, jinak insert/select spadne na RLS.
--
-- POSTUP: SQL Editor → New query → vlož celý tenhle soubor → Run.
-- Žádné ADMIN_USER_ID_ZDE tady není, nic se nedosazuje.

create table if not exists public.rostou_observations (
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

alter table public.rostou_observations enable row level security;

-- Uživatel smí vložit jen záznam se svým vlastním user_id (nejde podvrhnout
-- cizí - user_id má default auth.uid() a check to zase vynucuje).
drop policy if exists "Rostou insert own observations" on public.rostou_observations;
create policy "Rostou insert own observations" on public.rostou_observations
  for insert with check (auth.uid() = user_id);

-- Uživatel vidí jen svoje vlastní pozorování - appka teď nikde nezobrazuje
-- pozorování ostatních, tohle je jen rozumný výchozí stav soukromí.
drop policy if exists "Rostou read own observations" on public.rostou_observations;
create policy "Rostou read own observations" on public.rostou_observations
  for select using (auth.uid() = user_id);

-- Souhrnný přístup napříč všemi uživateli (pro budoucí ladění predikčního
-- modelu) jde jen přes service_role klíč mimo RLS - ne přes tuhle appku,
-- a ne přes anon klíč. To je záměr, ne mezera.

-- Uložená místa (dřív jen AsyncStorage v telefonu, proto vázaná na
-- zařízení, ne na účet - stejné zařízení s jiným přihlášeným účtem vidělo
-- cizí místa). Na rozdíl od observations tady uživatel svoje řádky i mění
-- (alerts toggle) a maže (odebrání místa), proto navíc update/delete policy.
create table if not exists public.rostou_saved_locations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  label text not null,
  alerts_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.rostou_saved_locations enable row level security;

drop policy if exists "Rostou insert own saved locations" on public.rostou_saved_locations;
create policy "Rostou insert own saved locations" on public.rostou_saved_locations
  for insert with check (auth.uid() = user_id);

drop policy if exists "Rostou read own saved locations" on public.rostou_saved_locations;
create policy "Rostou read own saved locations" on public.rostou_saved_locations
  for select using (auth.uid() = user_id);

drop policy if exists "Rostou update own saved locations" on public.rostou_saved_locations;
create policy "Rostou update own saved locations" on public.rostou_saved_locations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Rostou delete own saved locations" on public.rostou_saved_locations;
create policy "Rostou delete own saved locations" on public.rostou_saved_locations
  for delete using (auth.uid() = user_id);

-- Sledované druhy pro upozornění (dřív taky jen AsyncStorage) - stejný
-- problém jako u míst: preference vázaná na telefon, ne na účet.
create table if not exists public.rostou_watched_species (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  species_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, species_id)
);

alter table public.rostou_watched_species enable row level security;

drop policy if exists "Rostou insert own watched species" on public.rostou_watched_species;
create policy "Rostou insert own watched species" on public.rostou_watched_species
  for insert with check (auth.uid() = user_id);

drop policy if exists "Rostou read own watched species" on public.rostou_watched_species;
create policy "Rostou read own watched species" on public.rostou_watched_species
  for select using (auth.uid() = user_id);

drop policy if exists "Rostou delete own watched species" on public.rostou_watched_species;
create policy "Rostou delete own watched species" on public.rostou_watched_species
  for delete using (auth.uid() = user_id);

-- In-app notifikační feed (dřív jen AsyncStorage). unique(user_id,
-- dedupe_key) dělá dedup na úrovni DB (upsert + ignoreDuplicates) misto
-- ručně vedené Set v paměti, takže i po oříznutí feedu na MAX_NOTIFICATIONS
-- se stará položka znovu neobjeví jako "nová".
create table if not exists public.rostou_notifications (
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

alter table public.rostou_notifications enable row level security;

drop policy if exists "Rostou insert own notifications" on public.rostou_notifications;
create policy "Rostou insert own notifications" on public.rostou_notifications
  for insert with check (auth.uid() = user_id);

drop policy if exists "Rostou read own notifications" on public.rostou_notifications;
create policy "Rostou read own notifications" on public.rostou_notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Rostou update own notifications" on public.rostou_notifications;
create policy "Rostou update own notifications" on public.rostou_notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kalibrační feedback loop - odděleno od rostou_observations (volný
-- deníček bez vazby na konkrétní předpověď). Řádek je vždy per-species, ne
-- per-návštěva, protože kalibrace potřebuje vědět přesně KTEROU předpověď
-- odpověď potvrzuje/vyvrací. predicted_probability/factors/model_version se
-- vždy dopočítávají server-side v api/feedback.ts z historického počasí pro
-- target_date - appka je nikdy neposílá, aby šlo věřit, že "model řekl 78 %"
-- opravdu odpovídá tomu, co model toho dne spočítal (viz sekce 23 zadání -
-- klientským hodnotám pro prediction probability/model_version se nevěří).
create table if not exists public.rostou_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  species_id text not null,
  lat double precision not null,
  lon double precision not null,
  -- Zaokrouhlená poloha (~11 km) pro budoucí regionální kalibraci/agregaci
  -- bez nutnosti číst přesnou polohu uživatele - viz sekce 6/11 zadání.
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
  -- Umožňuje uživateli opravit vlastní odpověď (upsert), ale ne poslat ji
  -- podruhé jako nový záznam - a dovoluje novou návštěvu stejného místa v
  -- jiný den (target_date je součástí klíče).
  unique (user_id, species_id, lat, lon, target_date)
);

alter table public.rostou_feedback enable row level security;

drop policy if exists "Rostou insert own feedback" on public.rostou_feedback;
create policy "Rostou insert own feedback" on public.rostou_feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "Rostou update own feedback" on public.rostou_feedback;
create policy "Rostou update own feedback" on public.rostou_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Rostou read own feedback" on public.rostou_feedback;
create policy "Rostou read own feedback" on public.rostou_feedback
  for select using (auth.uid() = user_id);

-- Napříč uživateli čte jen noční rekalibrační job přes service_role klíč
-- (api/cron/recalibrate.ts) - stejná konvence jako u ostatních tabulek.

-- Noční agregace rostou_feedback do jednoho čísla na (druh, decile
-- pravděpodobnosti, verze modelu) - Beta-Binomial s posunem k
-- celo-aplikační sazbě daného decilu (viz SHRINKAGE_K v
-- api/cron/recalibrate.ts), takže pár prvních feedbacků k jednomu druhu
-- nevytvoří extrémní/nesmyslnou kalibraci. Psáno výhradně tím jobem přes
-- service_role klíč - proto žádná insert/update policy pro běžné uživatele.
create table if not exists public.rostou_calibration_stats (
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

alter table public.rostou_calibration_stats enable row level security;

-- Čitelné pro kohokoliv přihlášeného - /api/forecast to čte anon klíčem
-- jménem volajícího, aby mohl doladit zobrazenou pravděpodobnost. Žádná
-- osobní data uvnitř, jen agregáty.
drop policy if exists "Rostou read calibration stats" on public.rostou_calibration_stats;
create policy "Rostou read calibration stats" on public.rostou_calibration_stats
  for select using (true);
