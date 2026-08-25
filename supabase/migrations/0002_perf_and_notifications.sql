-- ===========================================================================
-- 0002 — Performance + notification clearing + role-change support
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Notification clearing
--    RLS blocks DELETE entirely today (no DELETE policy exists on any table),
--    so "clear notification" is impossible from the client until this lands.
-- ---------------------------------------------------------------------------
drop policy if exists notif_delete on public.notifications;
create policy notif_delete on public.notifications for delete
  using (recipient_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. RLS predicate caching
--    current_role()/current_status() are STABLE SECURITY DEFINER functions used
--    directly in row predicates, so Postgres may re-evaluate them per row.
--    Wrapping each call as (select ...) forces InitPlan caching — one
--    evaluation per query instead of one per row.
-- ---------------------------------------------------------------------------
drop policy if exists users_self_read on public.app_users;
create policy users_self_read on public.app_users for select
  using (id = auth.uid() or (select public.current_role()) in ('ADMIN','DIRECTOR'));

drop policy if exists users_admin_update on public.app_users;
create policy users_admin_update on public.app_users for update
  using ((select public.current_role()) in ('ADMIN','DIRECTOR') or id = auth.uid());

drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers for select
  using ((select public.current_status()) = 'APPROVED');

drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers for insert
  with check ((select public.current_status()) = 'APPROVED');

drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select
  using (
    (select public.current_status()) = 'APPROVED'
    and (created_by = auth.uid() or (select public.current_role()) in ('ACCOUNTANT','ADMIN','DIRECTOR'))
  );

drop policy if exists bookings_write on public.bookings;
create policy bookings_write on public.bookings for insert
  with check ((select public.current_status()) = 'APPROVED' and created_by = auth.uid());

drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update
  using (
    (select public.current_status()) = 'APPROVED'
    and (created_by = auth.uid() or (select public.current_role()) in ('ACCOUNTANT','ADMIN','DIRECTOR'))
  );

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (
    (select public.current_status()) = 'APPROVED'
    and (submitted_by = auth.uid() or (select public.current_role()) in ('ACCOUNTANT','ADMIN','DIRECTOR'))
  );

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for insert
  with check ((select public.current_status()) = 'APPROVED' and submitted_by = auth.uid());

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments for update
  using ((select public.current_role()) in ('ACCOUNTANT','ADMIN','DIRECTOR') or submitted_by = auth.uid());

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select
  using ((select public.current_role()) in ('ADMIN','DIRECTOR'));

-- ---------------------------------------------------------------------------
-- 3. Dashboard aggregates
--    The dashboard used to SELECT every booking row and reduce in JS to produce
--    six numbers. This computes them in Postgres and returns a single row.
--    SECURITY DEFINER + an explicit ownership filter, because RLS is bypassed.
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_stats()
returns table (
  total_bookings        bigint,
  total_value           numeric,
  total_received        numeric,
  total_pending         numeric,
  pending_verification  bigint,
  approved_count        bigint,
  rejected_count        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  urole user_role;
  ustatus user_status;
  scoped boolean;
begin
  select role, status into urole, ustatus from public.app_users where id = uid;

  if ustatus is distinct from 'APPROVED' then
    return query select 0::bigint, 0::numeric, 0::numeric, 0::numeric,
                        0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  -- SM and CP only ever see their own records; reviewers see everything.
  scoped := urole in ('SM','CP');

  return query
  select
    count(*)::bigint,
    coalesce(sum(b.total_property_value), 0),
    coalesce(sum(b.total_amount_paid), 0),
    coalesce(sum(b.remaining_balance), 0),
    count(*) filter (where b.status in ('SUBMITTED','UNDER_REVIEW','UPDATED'))::bigint,
    count(*) filter (where b.status = 'APPROVED')::bigint,
    count(*) filter (where b.status = 'REJECTED')::bigint
  from public.bookings b
  where (not scoped) or b.created_by = uid;
end;
$$;

revoke all on function public.get_dashboard_stats() from public;
grant execute on function public.get_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Supporting indexes for the newly-paginated list pages
-- ---------------------------------------------------------------------------
create index if not exists idx_bookings_created_at on public.bookings (created_at desc);
create index if not exists idx_payments_created_at on public.payments (created_at desc);
create index if not exists idx_bookings_submitted_at on public.bookings (submitted_at desc);
