-- Houbařský pes - per saved-location watchdog. A user picks a species (or
-- leaves it blank for "kterýkoli druh", matching the map's "overall" logic
-- in lib/grid.ts) and a probability threshold; api/cron/watchdog.ts checks
-- every active watchdog a few times a day and e-mails the owner once it's
-- crossed.
--
-- watchdog_notified_at tracks an in-progress "streak" above threshold, not
-- a history log: set the first time a check crosses the threshold, cleared
-- back to null the first time a later check finds the score has dropped
-- back below it - so a multi-day good stretch sends exactly one e-mail
-- (not one per day), and a later fresh crossing can notify again.
--
-- No new RLS policies needed - the existing "Hriboradar update own saved
-- locations" policy on hriboradar_saved_locations already covers any
-- column on a user's own row (see hriboradar_schema.sql), and the cron job
-- itself runs on the service_role key, which bypasses RLS entirely.
--
-- POSTUP: SQL Editor → New query → vlož celý tenhle soubor → Run.

alter table public.hriboradar_saved_locations
  add column if not exists watchdog_species_id text,
  add column if not exists watchdog_threshold_pct integer check (watchdog_threshold_pct between 1 and 100),
  add column if not exists watchdog_notified_at date;
