-- Hřiboradar - Supabase schema
-- Sdílený projekt s janvalis-portfolio/Gradus (Gradus-interiery) - tabulka
-- má prefix hriboradar_, aby se nepotkala s ničím existujícím. Na rozdíl od
-- janvalis_* tabulek (jeden pevný admin UID smí zapisovat) tady zapisuje
-- KAŽDÝ přihlášený uživatel, ale jen svoje vlastní řádky - auth.uid() musí
-- sedět se sloupcem user_id, jinak insert/select spadne na RLS.
--
-- Tohle je definice PRO NOVOU (prázdnou) instalaci. Pokud tabulky rostou_*
-- už existují s reálnými daty (appka se dřív jmenovala "Rostou?"), použijte
-- místo tohohle souboru supabase/migrations/001_rename_rostou_to_hriboradar.sql
-- - ten přejmenuje existující tabulky a zachová jejich obsah, tenhle soubor
-- by je vytvořil znovu (prázdné) vedle nich.
--
-- POSTUP (nová instalace): SQL Editor → New query → vlož celý tenhle
-- soubor → Run. Žádné ADMIN_USER_ID_ZDE tady není, nic se nedosazuje.

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

-- Uživatel smí vložit jen záznam se svým vlastním user_id (nejde podvrhnout
-- cizí - user_id má default auth.uid() a check to zase vynucuje).
drop policy if exists "Hriboradar insert own observations" on public.hriboradar_observations;
create policy "Hriboradar insert own observations" on public.hriboradar_observations
  for insert with check (auth.uid() = user_id);

-- Uživatel vidí jen svoje vlastní pozorování - appka teď nikde nezobrazuje
-- pozorování ostatních, tohle je jen rozumný výchozí stav soukromí.
drop policy if exists "Hriboradar read own observations" on public.hriboradar_observations;
create policy "Hriboradar read own observations" on public.hriboradar_observations
  for select using (auth.uid() = user_id);

-- Souhrnný přístup napříč všemi uživateli (pro budoucí ladění predikčního
-- modelu) jde jen přes service_role klíč mimo RLS - ne přes tuhle appku,
-- a ne přes anon klíč. To je záměr, ne mezera.

-- Uložená místa (dřív jen AsyncStorage v telefonu, proto vázaná na
-- zařízení, ne na účet - stejné zařízení s jiným přihlášeným účtem vidělo
-- cizí místa). Na rozdíl od observations tady uživatel svoje řádky i mění
-- (alerts toggle) a maže (odebrání místa), proto navíc update/delete policy.
create table if not exists public.hriboradar_saved_locations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  label text not null,
  alerts_enabled boolean not null default true,
  -- Houbařský pes (watchdog) - null species_id means "kterýkoli druh"
  -- (the same weighted-top-3 "overall" logic as lib/grid.ts), null
  -- threshold_pct means the watchdog is off. notified_at tracks an
  -- in-progress streak above threshold (see migrations/002_add_watchdog.sql
  -- for why), not a history log - api/cron/watchdog.ts reads/writes it.
  watchdog_species_id text,
  watchdog_threshold_pct integer check (watchdog_threshold_pct between 1 and 100),
  watchdog_notified_at date,
  created_at timestamptz not null default now()
);

alter table public.hriboradar_saved_locations enable row level security;

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

-- Sledované druhy pro upozornění (dřív taky jen AsyncStorage) - stejný
-- problém jako u míst: preference vázaná na telefon, ne na účet.
create table if not exists public.hriboradar_watched_species (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  species_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, species_id)
);

alter table public.hriboradar_watched_species enable row level security;

drop policy if exists "Hriboradar insert own watched species" on public.hriboradar_watched_species;
create policy "Hriboradar insert own watched species" on public.hriboradar_watched_species
  for insert with check (auth.uid() = user_id);

drop policy if exists "Hriboradar read own watched species" on public.hriboradar_watched_species;
create policy "Hriboradar read own watched species" on public.hriboradar_watched_species
  for select using (auth.uid() = user_id);

drop policy if exists "Hriboradar delete own watched species" on public.hriboradar_watched_species;
create policy "Hriboradar delete own watched species" on public.hriboradar_watched_species
  for delete using (auth.uid() = user_id);

-- In-app notifikační feed (dřív jen AsyncStorage). unique(user_id,
-- dedupe_key) dělá dedup na úrovni DB (upsert + ignoreDuplicates) misto
-- ručně vedené Set v paměti, takže i po oříznutí feedu na MAX_NOTIFICATIONS
-- se stará položka znovu neobjeví jako "nová".
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

drop policy if exists "Hriboradar insert own notifications" on public.hriboradar_notifications;
create policy "Hriboradar insert own notifications" on public.hriboradar_notifications
  for insert with check (auth.uid() = user_id);

drop policy if exists "Hriboradar read own notifications" on public.hriboradar_notifications;
create policy "Hriboradar read own notifications" on public.hriboradar_notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Hriboradar update own notifications" on public.hriboradar_notifications;
create policy "Hriboradar update own notifications" on public.hriboradar_notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kalibrační feedback loop - odděleno od hriboradar_observations (volný
-- deníček bez vazby na konkrétní předpověď). Řádek je vždy per-species, ne
-- per-návštěva, protože kalibrace potřebuje vědět přesně KTEROU předpověď
-- odpověď potvrzuje/vyvrací. predicted_probability/factors/model_version se
-- vždy dopočítávají server-side v api/feedback.ts z historického počasí pro
-- target_date - appka je nikdy neposílá, aby šlo věřit, že "model řekl 78 %"
-- opravdu odpovídá tomu, co model toho dne spočítal (viz sekce 23 zadání -
-- klientským hodnotám pro prediction probability/model_version se nevěří).
create table if not exists public.hriboradar_feedback (
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

alter table public.hriboradar_feedback enable row level security;

drop policy if exists "Hriboradar insert own feedback" on public.hriboradar_feedback;
create policy "Hriboradar insert own feedback" on public.hriboradar_feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "Hriboradar update own feedback" on public.hriboradar_feedback;
create policy "Hriboradar update own feedback" on public.hriboradar_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Hriboradar read own feedback" on public.hriboradar_feedback;
create policy "Hriboradar read own feedback" on public.hriboradar_feedback
  for select using (auth.uid() = user_id);

-- Napříč uživateli čte jen noční rekalibrační job přes service_role klíč
-- (api/cron/recalibrate.ts) - stejná konvence jako u ostatních tabulek.

-- Noční agregace hriboradar_feedback do jednoho čísla na (druh, decile
-- pravděpodobnosti, verze modelu) - Beta-Binomial s posunem k
-- celo-aplikační sazbě daného decilu (viz SHRINKAGE_K v
-- api/cron/recalibrate.ts), takže pár prvních feedbacků k jednomu druhu
-- nevytvoří extrémní/nesmyslnou kalibraci. Psáno výhradně tím jobem přes
-- service_role klíč - proto žádná insert/update policy pro běžné uživatele.
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

-- Čitelné pro kohokoliv přihlášeného - /api/forecast to čte anon klíčem
-- jménem volajícího, aby mohl doladit zobrazenou pravděpodobnost. Žádná
-- osobní data uvnitř, jen agregáty.
drop policy if exists "Hriboradar read calibration stats" on public.hriboradar_calibration_stats;
create policy "Hriboradar read calibration stats" on public.hriboradar_calibration_stats
  for select using (true);

-- Hřiboradar Plus - server-side zrcadlo předplatného. Appka samotná gatuje
-- funkce podle RevenueCat SDK stavu přímo na zařízení (rychlejší, funguje
-- i bez zásahu serveru) - tahle tabulka NENÍ ten gating mechanismus, je to
-- záznam pro api/webhooks/revenuecat.ts (odesílání e-mailů při
-- předplatit/zrušit, budoucí administrativa/podpora). Psáno výhradně tím
-- webhookem přes service_role klíč - proto žádná insert/update policy pro
-- běžné uživatele, stejná konvence jako hriboradar_calibration_stats.
create table if not exists public.hriboradar_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revenuecat_customer_id text,
  status text not null default 'none', -- none | active | trial | canceled | expired | billing_issue
  product_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.hriboradar_subscriptions enable row level security;

-- Uživatel vidí jen svůj vlastní stav předplatného - žádná zápisová
-- politika, viz komentář výše.
drop policy if exists "Hriboradar read own subscription" on public.hriboradar_subscriptions;
create policy "Hriboradar read own subscription" on public.hriboradar_subscriptions
  for select using (auth.uid() = user_id);

-- Expo push tokeny - jeden řádek na (uživatel, zařízení). Zápisové jen z
-- pohledu klienta (insert/update/delete vlastních řádků) - appka si svůj
-- token nikdy nepotřebuje číst zpět, jen ho poslat. api/cron/watchdog.ts
-- čte napříč uživateli přes service_role klíč (obchází RLS).
create table if not exists public.hriboradar_push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  -- Měsíční tip (pranostika + houby v sezóně) jako skutečný push 1. den v
  -- měsíci (api/cron/recalibrate.ts, lib/monthlyTip.ts) - appka nastavuje
  -- tohle spolu s registrací tokenu, kdykoli uživatel přepne "Měsíční tip"
  -- v Nastavení (api/push-token.ts).
  monthly_tip_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.hriboradar_push_tokens enable row level security;

drop policy if exists "Hriboradar insert own push token" on public.hriboradar_push_tokens;
create policy "Hriboradar insert own push token" on public.hriboradar_push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "Hriboradar update own push token" on public.hriboradar_push_tokens;
create policy "Hriboradar update own push token" on public.hriboradar_push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Hriboradar delete own push token" on public.hriboradar_push_tokens;
create policy "Hriboradar delete own push token" on public.hriboradar_push_tokens
  for delete using (auth.uid() = user_id);

-- Jednou denně předpočítané počasí (lib/weather.ts) pro ~350 pevných bodů
-- mapové mřížky (lib/gridPoints.ts, 15 km rozestup) - api/cron/refresh-weather.ts
-- naplní tuhle tabulku, lib/weather.ts's fetchWeather() z ní čte místo
-- živého volání Open-Meteo na každý request. Bez tohohle appka posílala
-- stovky souběžných Open-Meteo volání na živo (mapa) i desítky (Domů,
-- Předpověď) - narazilo to na jejich rate limit a asi polovina requestů
-- padala na 500 (found 2026-09-03). `days` je celé pole DayWeather z
-- lib/weather.ts (historie + 7denní výhled) jako JSON, ne rozepsané do
-- sloupců - stejná data appka i tak čte jen jako celek.
create table if not exists public.hriboradar_weather_grid (
  grid_lat real not null,
  grid_lon real not null,
  days jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (grid_lat, grid_lon)
);

alter table public.hriboradar_weather_grid enable row level security;

-- Čitelné pro kohokoliv (i nepřihlášeného) - /api/forecast, /api/grid a
-- /api/map to čtou anon klíčem, žádná osobní data uvnitř, jen počasí.
-- Psáno výhradně cronem přes service_role klíč, proto žádná zápisová
-- politika - stejná konvence jako hriboradar_calibration_stats.
drop policy if exists "Hriboradar read weather grid" on public.hriboradar_weather_grid;
create policy "Hriboradar read weather grid" on public.hriboradar_weather_grid
  for select using (true);
