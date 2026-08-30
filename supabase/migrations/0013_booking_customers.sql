-- Allow one booking to belong to one or more customers, including customers
-- attached after the booking is created. `bookings.customer_id` remains the
-- primary customer for backwards compatibility with existing screens.

create table if not exists public.booking_customers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (booking_id, customer_id)
);

create unique index if not exists idx_booking_customers_primary
  on public.booking_customers(booking_id) where is_primary;
create index if not exists idx_booking_customers_customer
  on public.booking_customers(customer_id);

alter table public.booking_customers enable row level security;

drop policy if exists booking_customers_read on public.booking_customers;
create policy booking_customers_read on public.booking_customers for select
  using (
    (select public.current_status()) = 'APPROVED'
    and exists (
      select 1 from public.bookings b
      where b.id::text = booking_id::text
        and (b.created_by::text = auth.uid()::text or (select public.current_role()) in ('ACCOUNTANT','ADMIN','DIRECTOR'))
    )
  );

drop policy if exists booking_customers_insert on public.booking_customers;
create policy booking_customers_insert on public.booking_customers for insert
  with check (
    (select public.current_status()) = 'APPROVED'
    and exists (select 1 from public.bookings b where b.id::text = booking_id::text and b.created_by::text = auth.uid()::text)
  );

drop policy if exists booking_customers_update on public.booking_customers;
create policy booking_customers_update on public.booking_customers for update
  using (
    (select public.current_status()) = 'APPROVED'
    and exists (
      select 1 from public.bookings b
      where b.id::text = booking_id::text
        and (b.created_by::text = auth.uid()::text or (select public.current_role()) in ('ACCOUNTANT','ADMIN','DIRECTOR'))
    )
  );

-- Backfill the existing single customer relation.
insert into public.booking_customers (booking_id, customer_id, is_primary)
select id, customer_id, true from public.bookings
on conflict (booking_id, customer_id) do update set is_primary = true;

notify pgrst, 'reload schema';
