-- Měsíční tip (pranostika + houby v sezóně) se teď posílá jako skutečný
-- push 1. den v měsíci (api/cron/recalibrate.ts), ne jen jako lokální
-- oznámení generované v appce - viz lib/monthlyTip.ts. Tenhle sloupec říká
-- cronu, kterým tokenům push poslat; appka ho nastavuje spolu s
-- registrací tokenu, kdykoli uživatel přepne přepínač "Měsíční tip" v
-- Nastavení (viz api/push-token.ts).
--
-- POSTUP: SQL Editor → New query → vlož celý tenhle soubor → Run.

alter table public.hriboradar_push_tokens
  add column if not exists monthly_tip_enabled boolean not null default true;
