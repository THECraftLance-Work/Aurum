-- ===========================================================================
-- 0011 — Bank details on bookings + working document uploads
--
--   * bank_* columns on bookings (payment source / loan bank, for reconciliation)
--   * attachments table + private Storage bucket, so the existing upload UI
--     actually persists something instead of dropping the file
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Bank details
--
-- NOTE: bank_account_number is sensitive. It is protected by the existing
-- bookings RLS (creator + ACCOUNTANT/ADMIN/DIRECTOR only) and never leaves the
-- server except to those roles. Capture only what reconciliation needs.
-- ---------------------------------------------------------------------------
alter table public.bookings add column if not exists bank_name           text;
alter table public.bookings add column if not exists bank_account_holder text;
alter table public.bookings add column if not exists bank_account_number text;
alter table public.bookings add column if not exists bank_ifsc           text;
alter table public.bookings add column if not exists bank_branch         text;
alter table public.bookings add column if not exists loan_sanctioned     boolean not null default false;
alter table public.bookings add column if not exists loan_amount         numeric(14,2);

alter table public.bookings
  drop constraint if exists bookings_loan_amount_check;
alter table public.bookings
  add constraint bookings_loan_amount_check
  check (loan_amount is null or loan_amount >= 0);

-- ---------------------------------------------------------------------------
-- 2. Attachments
--
-- One table for every entity rather than per-table columns: a booking can have
-- an agreement AND an ID proof, a payment can have a receipt, and a ticket can
-- have a screenshot. Rows point at objects in the `documents` Storage bucket.
-- ---------------------------------------------------------------------------
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('booking','payment','ticket')),
  entity_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  mime_type text not null,
  label text,
  uploaded_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_entity
  on public.attachments (entity_type, entity_id, created_at desc);

alter table public.attachments enable row level security;

-- Visible to anyone who can see the parent record. Bookings/payments already
-- scope SM/CP to their own rows, so this inherits that without restating it.
drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments for select
  using (
    (select public.current_status()) = 'APPROVED'
    and (
      uploaded_by = auth.uid()
      or (select public.current_role()) in ('ACCOUNTANT','ADMIN','DIRECTOR')
      or (entity_type = 'booking' and exists (
            select 1 from public.bookings b
             where b.id = entity_id and b.created_by = auth.uid()))
      or (entity_type = 'payment' and exists (
            select 1 from public.payments p
             where p.id = entity_id and p.submitted_by = auth.uid()))
      or (entity_type = 'ticket' and exists (
            select 1 from public.tickets t
             where t.id = entity_id and t.raised_by = auth.uid()))
    )
  );

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert
  with check ((select public.current_status()) = 'APPROVED' and uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Storage bucket
--
-- PRIVATE. Files are booking agreements, ID proofs and payment receipts — they
-- must never be served from a public URL. The app hands out short-lived signed
-- URLs instead.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,  -- 10 MB, matching the helper text in the upload UI
  array['application/pdf','image/png','image/jpeg','image/jpg','image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are keyed `<user-id>/<uuid>-<filename>`, so the first path segment is
-- the uploader. That lets us scope writes per user without a metadata lookup.
drop policy if exists documents_insert on storage.objects;
create policy documents_insert on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select public.current_status()) = 'APPROVED'
  );

drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select
  using (
    bucket_id = 'documents'
    and (select public.current_status()) = 'APPROVED'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (select public.current_role()) in ('ACCOUNTANT','ADMIN','DIRECTOR')
    )
  );

-- Uploaders may delete their own object, which covers "remove" in the picker
-- before the form is submitted. Nobody can delete someone else's.
drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
