-- ===========================================================================
-- 0003 — Add the TICKET notification category
--
-- This file deliberately contains NOTHING ELSE.
--
-- Postgres forbids using a new enum value in the same transaction that added
-- it, and Supabase runs each migration file in one transaction. Combining this
-- with 0004 (which inserts TICKET notifications) would fail at deploy time.
-- ===========================================================================
alter type notification_category add value if not exists 'TICKET';
