-- ===========================================================================
-- 0012 — Per-payment verification support + query indexes
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Indexes for the queries added with the payment review workflow.
--
-- The verification queue's Payments tab filters on status and orders by
-- created_at; without a matching index that is a full scan plus a sort on
-- every load. The partial index is small because only unreviewed rows qualify.
-- ---------------------------------------------------------------------------
create index if not exists idx_payments_pending
  on public.payments (created_at)
  where status in ('PENDING', 'UNDER_REVIEW');

-- Payments list: scoped by submitter (SM/CP) or filtered by status, newest first.
create index if not exists idx_payments_submitter_created
  on public.payments (submitted_by, created_at desc);
create index if not exists idx_payments_status_created
  on public.payments (status, created_at desc);

-- Booking detail loads a booking's payments newest-first.
create index if not exists idx_payments_booking_created
  on public.payments (booking_id, created_at desc);

-- Attachment lookups on the booking and payment detail pages.
create index if not exists idx_attachments_entity_created
  on public.attachments (entity_type, entity_id, created_at desc);

-- Audit trail on the booking detail page.
create index if not exists idx_audit_entity_created
  on public.audit_logs (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Let reviewers see the pending-payment count regardless of who submitted.
--
-- payments_read already grants ACCOUNTANT/ADMIN/DIRECTOR full read, so no
-- policy change is needed — this comment records that the queue depends on it.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. Guard the invariant the recalc trigger cannot express.
--
-- recalc_booking_totals() sums APPROVED payments into bookings.total_amount_paid.
-- Nothing stopped that sum exceeding total_property_value, which would make
-- remaining_balance (a generated column) negative. The API checks this before
-- approving; this is the database-level backstop.
-- ---------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_paid_not_over_value;
alter table public.bookings
  add constraint bookings_paid_not_over_value
  check (total_amount_paid <= total_property_value) not valid;

-- NOT VALID: existing rows are left alone (any historical overpayment stays
-- readable), but every future insert or update is checked. Run
--   alter table public.bookings validate constraint bookings_paid_not_over_value;
-- once you've confirmed no current row violates it.

notify pgrst, 'reload schema';
