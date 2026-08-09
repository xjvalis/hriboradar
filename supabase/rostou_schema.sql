-- Rostou? — Supabase schema
-- Sdílený projekt s janvalis-portfolio/Gradus (Gradus-interiery) — tabulka
-- má prefix rostou_, aby se nepotkala s ničím existujícím. Na rozdíl od
-- janvalis_* tabulek (jeden pevný admin UID smí zapisovat) tady zapisuje
-- KAŽDÝ přihlášený uživatel, ale jen svoje vlastní řádky — auth.uid() musí
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
-- cizí — user_id má default auth.uid() a check to zase vynucuje).
drop policy if exists "Rostou insert own observations" on public.rostou_observations;
create policy "Rostou insert own observations" on public.rostou_observations
  for insert with check (auth.uid() = user_id);

-- Uživatel vidí jen svoje vlastní pozorování — appka teď nikde nezobrazuje
-- pozorování ostatních, tohle je jen rozumný výchozí stav soukromí.
drop policy if exists "Rostou read own observations" on public.rostou_observations;
create policy "Rostou read own observations" on public.rostou_observations
  for select using (auth.uid() = user_id);

-- Souhrnný přístup napříč všemi uživateli (pro budoucí ladění predikčního
-- modelu) jde jen přes service_role klíč mimo RLS — ne přes tuhle appku,
-- a ne přes anon klíč. To je záměr, ne mezera.
