-- Expo push tokens - one row per (user, device). A user can have several
-- (phone + tablet, or a reinstall that got a fresh token before the old
-- one expired), so this is its own table, not a column on auth.users.
--
-- Write-only from the client's own perspective (insert/update/delete their
-- own rows) - no select policy, since the app never needs to read its own
-- token back, only push it. api/cron/watchdog.ts reads across all users
-- via the service_role key, which bypasses RLS entirely (see
-- hriboradar_schema.sql's convention for cron-only tables).
--
-- POSTUP: SQL Editor → New query → vlož celý tenhle soubor → Run.

create table if not exists public.hriboradar_push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

alter table public.hriboradar_push_tokens enable row level security;

drop policy if exists "Hriboradar insert own push token" on public.hriboradar_push_tokens;
create policy "Hriboradar insert own push token" on public.hriboradar_push_tokens
  for insert with check (auth.uid() = user_id);

-- Same token re-registered (app reopened, still the same device) upserts
-- via onConflict:"token" - needs an update policy, not just insert, for
-- that upsert path to succeed for a token this same user already owns.
drop policy if exists "Hriboradar update own push token" on public.hriboradar_push_tokens;
create policy "Hriboradar update own push token" on public.hriboradar_push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lets the app unregister a token on sign-out, so a shared/reused device
-- doesn't keep pushing to whoever signed out of it.
drop policy if exists "Hriboradar delete own push token" on public.hriboradar_push_tokens;
create policy "Hriboradar delete own push token" on public.hriboradar_push_tokens
  for delete using (auth.uid() = user_id);
