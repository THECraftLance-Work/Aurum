-- ===========================================================================
-- 0009 — Add the SENDING delivery status
--
-- This file deliberately contains NOTHING ELSE.
--
-- notification_deliveries was created from an earlier draft schema, so
-- `create type ... exception when duplicate_object` in 0005 skipped the real
-- enum and SENDING was never added. The worker uses SENDING as its
-- compare-and-set claim marker, so without this every claim fails.
--
-- Postgres forbids USING a new enum value in the same transaction that added
-- it, and Supabase runs each migration file in one transaction — hence the
-- separate file.
-- ===========================================================================

alter type delivery_status add value if not exists 'SENDING';
