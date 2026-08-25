-- ===========================================================================
-- 0006 — Repair: add missing ticket enum values
--
-- This file deliberately contains NOTHING ELSE.
--
-- The tickets tables were created from an earlier draft schema, so
-- `create table if not exists` in 0004 silently skipped the real definitions
-- and these enum values were never added.
--
-- Postgres forbids USING a new enum value in the same transaction that added
-- it, and Supabase runs each migration file in one transaction — so these must
-- land here, separately from 0007 which references them.
-- ===========================================================================

alter type ticket_status   add value if not exists 'WAITING_ON_USER';
alter type ticket_category add value if not exists 'BUG';
alter type ticket_category add value if not exists 'FEATURE_REQUEST';
