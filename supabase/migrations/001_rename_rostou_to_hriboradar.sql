-- Přejmenování rostou_* tabulek na hriboradar_* v rámci rebrandingu appky
-- na "Hřiboradar". Spustit RUČNĚ v Supabase SQL Editoru PŘED nasazením
-- nového kódu (kód po tomto commitu už čte/zapisuje jen hriboradar_* jména
-- - viz .from("hriboradar_...") volání v api/, lib/, mobile/src/).
--
-- ALTER TABLE ... RENAME TO zachovává veškerá data, sloupce, indexy,
-- cizí klíče i RLS nastavení - jen mění jméno objektu, takže tohle je
-- bezpečné spustit i na tabulkách s reálnými daty. Přejmenování politik
-- (ALTER POLICY) je jen kosmetické (na fungování appky nemá vliv), ale
-- drží název politiky konzistentní s novým jménem tabulky.
--
-- POSTUP: SQL Editor → New query → vlož celý tenhle soubor → Run.
-- Po úspěšném běhu je supabase/rostou_schema.sql nahrazen
-- supabase/hriboradar_schema.sql jako aktuální definice - ten starý soubor
-- už neupravujte, slouží jen jako historický záznam před rebrandingem.

alter table if exists public.rostou_observations rename to hriboradar_observations;
alter policy "Rostou insert own observations" on public.hriboradar_observations rename to "Hriboradar insert own observations";
alter policy "Rostou read own observations" on public.hriboradar_observations rename to "Hriboradar read own observations";

alter table if exists public.rostou_saved_locations rename to hriboradar_saved_locations;
alter policy "Rostou insert own saved locations" on public.hriboradar_saved_locations rename to "Hriboradar insert own saved locations";
alter policy "Rostou read own saved locations" on public.hriboradar_saved_locations rename to "Hriboradar read own saved locations";
alter policy "Rostou update own saved locations" on public.hriboradar_saved_locations rename to "Hriboradar update own saved locations";
alter policy "Rostou delete own saved locations" on public.hriboradar_saved_locations rename to "Hriboradar delete own saved locations";

alter table if exists public.rostou_watched_species rename to hriboradar_watched_species;
alter policy "Rostou insert own watched species" on public.hriboradar_watched_species rename to "Hriboradar insert own watched species";
alter policy "Rostou read own watched species" on public.hriboradar_watched_species rename to "Hriboradar read own watched species";
alter policy "Rostou delete own watched species" on public.hriboradar_watched_species rename to "Hriboradar delete own watched species";

alter table if exists public.rostou_notifications rename to hriboradar_notifications;
alter policy "Rostou insert own notifications" on public.hriboradar_notifications rename to "Hriboradar insert own notifications";
alter policy "Rostou read own notifications" on public.hriboradar_notifications rename to "Hriboradar read own notifications";
alter policy "Rostou update own notifications" on public.hriboradar_notifications rename to "Hriboradar update own notifications";

alter table if exists public.rostou_feedback rename to hriboradar_feedback;
alter policy "Rostou insert own feedback" on public.hriboradar_feedback rename to "Hriboradar insert own feedback";
alter policy "Rostou update own feedback" on public.hriboradar_feedback rename to "Hriboradar update own feedback";
alter policy "Rostou read own feedback" on public.hriboradar_feedback rename to "Hriboradar read own feedback";

alter table if exists public.rostou_calibration_stats rename to hriboradar_calibration_stats;
alter policy "Rostou read calibration stats" on public.hriboradar_calibration_stats rename to "Hriboradar read calibration stats";

alter table if exists public.rostou_subscriptions rename to hriboradar_subscriptions;
alter policy "Rostou read own subscription" on public.hriboradar_subscriptions rename to "Hriboradar read own subscription";
