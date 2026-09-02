-- Jednou denně předpočítané počasí (lib/weather.ts) pro ~350 pevných bodů
-- mapové mřížky (lib/gridPoints.ts, 15 km rozestup) - api/cron/refresh-weather.ts
-- naplní tuhle tabulku, lib/weather.ts's fetchWeather() z ní čte místo
-- živého volání Open-Meteo na každý request. Bez tohohle appka posílala
-- stovky souběžných Open-Meteo volání na živo (mapa) i desítky (Domů,
-- Předpověď) - narazilo to na jejich rate limit a asi polovina requestů
-- padala na 500 (found 2026-09-03). `days` je celé pole DayWeather z
-- lib/weather.ts (historie + 7denní výhled) jako JSON, ne rozepsané do
-- sloupců - stejná data appka i tak čte jen jako celek.
--
-- POSTUP: SQL Editor → New query → vlož celý tenhle soubor → Run.

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
