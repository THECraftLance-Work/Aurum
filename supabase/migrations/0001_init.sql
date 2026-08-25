-- R&M Real Estate — Internal Operations Platform
-- Initial schema: users, customers, bookings, payments, notifications, audit logs

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
do $$ begin
  create type user_role as enum ('SM','CP','ACCOUNTANT','ADMIN','DIRECTOR');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('PENDING_APPROVAL','APPROVED','REJECTED','SUSPENDED','DISABLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type auth_provider as enum ('GOOGLE','EMAIL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','UPDATED','ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('PENDING','UNDER_REVIEW','APPROVED','REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_mode as enum ('BANK_TRANSFER','UPI','CHEQUE','CASH','CARD','OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_priority as enum ('LOW','NORMAL','HIGH','URGENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_category as enum (
    'ACCESS_REQUEST','APPROVAL','REJECTION','PAYMENT','BOOKING','SYSTEM','IMPORTANT'
  );
exception when duplicate_object then null; end $$;

-- ============================================================================
-- USERS  (mirrors auth.users, adds business fields)
-- ============================================================================
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role user_role not null default 'SM',
  requested_role user_role,
  employee_id text,
  auth_provider auth_provider not null default 'EMAIL',
  status user_status not null default 'PENDING_APPROVAL',
  avatar_url text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.app_users(id),
  last_login_at timestamptz
);

create index if not exists idx_users_role on public.app_users(role);
create index if not exists idx_users_status on public.app_users(status);

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_customers_name on public.customers(lower(name));
create index if not exists idx_customers_phone on public.customers(phone);

-- ============================================================================
-- BOOKING ID SEQUENCE  (RM + YY + 5-digit counter)
-- ============================================================================
create sequence if not exists booking_id_seq start 1000;

create or replace function public.generate_booking_id() returns text as $$
declare
  yy text := to_char(now(), 'YY');
  nxt bigint;
begin
  nxt := nextval('booking_id_seq');
  return 'RM' || yy || lpad(nxt::text, 5, '0');
end;
$$ language plpgsql;

-- ============================================================================
-- BOOKINGS
-- ============================================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique default public.generate_booking_id(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  project_name text not null,
  unit_number text not null,
  property_details text,
  total_property_value numeric(14,2) not null check (total_property_value >= 0),
  total_amount_paid numeric(14,2) not null default 0 check (total_amount_paid >= 0),
  remaining_balance numeric(14,2) generated always as (total_property_value - total_amount_paid) stored,
  notes text,
  status booking_status not null default 'SUBMITTED',
  created_by uuid not null references public.app_users(id),
  creator_role user_role not null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.app_users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_created_by on public.bookings(created_by);
create index if not exists idx_bookings_customer on public.bookings(customer_id);
create index if not exists idx_bookings_project on public.bookings(lower(project_name));

-- ============================================================================
-- PAYMENTS  (multiple per booking — historical)
-- ============================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null,
  payment_mode payment_mode not null,
  reference_no text,
  status payment_status not null default 'PENDING',
  submitted_by uuid not null references public.app_users(id),
  reviewed_by uuid references public.app_users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_booking on public.payments(booking_id);
create index if not exists idx_payments_status on public.payments(status);

-- Recalculate booking.total_amount_paid whenever an APPROVED payment changes
create or replace function public.recalc_booking_totals() returns trigger as $$
declare
  bid uuid := coalesce(new.booking_id, old.booking_id);
  total numeric(14,2);
begin
  select coalesce(sum(amount),0) into total
  from public.payments
  where booking_id = bid and status = 'APPROVED';
  update public.bookings set total_amount_paid = total, updated_at = now() where id = bid;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_payments_recalc on public.payments;
create trigger trg_payments_recalc
after insert or update or delete on public.payments
for each row execute function public.recalc_booking_totals();

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.app_users(id) on delete cascade,
  category notification_category not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  priority notification_priority not null default 'NORMAL',
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications(recipient_user_id, is_read);
create index if not exists idx_notif_created on public.notifications(created_at desc);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id),
  actor_role user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_actor on public.audit_logs(actor_user_id);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.app_users     enable row level security;
alter table public.customers     enable row level security;
alter table public.bookings      enable row level security;
alter table public.payments      enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs    enable row level security;

create or replace function public.current_role() returns user_role as $$
  select role from public.app_users where id = auth.uid();
$$ language sql stable security definer;

create or replace function public.current_status() returns user_status as $$
  select status from public.app_users where id = auth.uid();
$$ language sql stable security definer;

-- Users
drop policy if exists users_self_read on public.app_users;
create policy users_self_read on public.app_users for select
  using (id = auth.uid() or public.current_role() in ('ADMIN','DIRECTOR'));

drop policy if exists users_self_insert on public.app_users;
create policy users_self_insert on public.app_users for insert
  with check (id = auth.uid());

drop policy if exists users_admin_update on public.app_users;
create policy users_admin_update on public.app_users for update
  using (public.current_role() in ('ADMIN','DIRECTOR') or id = auth.uid());

-- Bookings: creator sees own; reviewers (Accountant/Admin/Director) see all APPROVED users only
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select
  using (
    public.current_status() = 'APPROVED'
    and (
      created_by = auth.uid()
      or public.current_role() in ('ACCOUNTANT','ADMIN','DIRECTOR')
    )
  );

drop policy if exists bookings_write on public.bookings;
create policy bookings_write on public.bookings for insert
  with check (public.current_status() = 'APPROVED' and created_by = auth.uid());

drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update
  using (
    public.current_status() = 'APPROVED'
    and (created_by = auth.uid() or public.current_role() in ('ACCOUNTANT','ADMIN','DIRECTOR'))
  );

-- Customers: any approved user can read; creator writes
drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers for select
  using (public.current_status() = 'APPROVED');
drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers for insert
  with check (public.current_status() = 'APPROVED');

-- Payments
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (
    public.current_status() = 'APPROVED'
    and (
      submitted_by = auth.uid()
      or public.current_role() in ('ACCOUNTANT','ADMIN','DIRECTOR')
    )
  );
drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for insert
  with check (public.current_status() = 'APPROVED' and submitted_by = auth.uid());
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments for update
  using (public.current_role() in ('ACCOUNTANT','ADMIN','DIRECTOR') or submitted_by = auth.uid());

-- Notifications: only recipient
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select using (recipient_user_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update using (recipient_user_id = auth.uid());

-- Audit log: Admin/Director only
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select
  using (public.current_role() in ('ADMIN','DIRECTOR'));

-- Enable realtime
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.app_users;
