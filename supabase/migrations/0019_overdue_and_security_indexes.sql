-- ---------------------------------------------------------------------------
-- 0019: indexes for the overdue-payment sweep and the security audit trail.
--
-- Safe to re-run. Contains no enum changes, so it does not need to be applied
-- on its own the way 0003 / 0006 / 0009 did.
-- ---------------------------------------------------------------------------

-- The daily sweep in /api/cron/payment-reminders filters on status, then on a
-- positive remaining balance, then orders by age. `idx_bookings_status` alone
-- makes that a filter over every submitted booking. This partial index holds
-- only the rows with money still outstanding, which is the small set the sweep
-- actually cares about, and keeps them ordered by age so no sort is needed.
create index if not exists idx_bookings_outstanding
  on public.bookings (status, created_at)
  where remaining_balance > 0;

-- "When did money last arrive on this booking" — one row per booking, newest
-- first. Without this the sweep sequential-scans payments once per run.
create index if not exists idx_payments_approved_by_booking
  on public.payments (booking_id, payment_date desc)
  where status = 'APPROVED';

-- Directors reviewing access attempts filter the audit log by action. There is
-- an index on created_at and one on actor, but none that makes "show me every
-- ACCESS_DENIED, newest first" cheap.
create index if not exists idx_audit_action_created
  on public.audit_logs (action, created_at desc);

-- Customer-facing mail fans out across booking_customers -> customers on every
-- payment event. The junction had an index on customer_id but the lookup goes
-- the other way, and ordering primary-first was an unindexed sort.
create index if not exists idx_booking_customers_booking
  on public.booking_customers (booking_id, is_primary desc, created_at);

-- The alerter reads every approved Director on each access attempt.
create index if not exists idx_users_role_status
  on public.app_users (role, status);

notify pgrst, 'reload schema';
