-- ===========================================================================
-- 0005 — Outbound notification bridge (WhatsApp + Email)
--   * notification_recipients : who receives org-level alerts
--   * notification_deliveries : durable outbox + audit trail of every attempt
-- ===========================================================================

do $$ begin
  create type delivery_channel as enum ('WHATSAPP','EMAIL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_status as enum ('QUEUED','SENDING','SENT','FAILED','SKIPPED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Recipient list. DB-backed rather than env-only so ops can change who gets
-- alerted without a redeploy. Env vars act as a bootstrap when this is empty.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  channel delivery_channel not null,
  destination text not null,              -- E.164 with '+' | email address
  events text[] not null default '{BOOKING_SUBMITTED,PAYMENT_ADDED}',
  is_active boolean not null default true,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  unique (channel, destination)
);
create index if not exists idx_notif_recipients_active
  on public.notification_recipients(channel) where is_active;

-- ---------------------------------------------------------------------------
-- Outbox. A row is written inside the request (fast, durable), then delivered
-- by an opportunistic inline kick and/or the cron drain endpoint.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,                 -- 'BOOKING_SUBMITTED' | 'PAYMENT_ADDED'
  channel delivery_channel not null,
  provider text not null default 'pending',-- 'meta_whatsapp' | 'resend' | 'noop'
  recipient text not null,
  entity_type text,
  entity_id uuid,
  template_name text,
  subject text,
  payload jsonb,                           -- request body sent (never secrets)
  status delivery_status not null default 'QUEUED',
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  error_code text,
  error_message text,
  dedupe_key text unique,                  -- '<event>:<entity>:<channel>:<recipient>'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_deliveries_due
  on public.notification_deliveries (next_attempt_at)
  where status in ('QUEUED','FAILED');
create index if not exists idx_deliveries_entity
  on public.notification_deliveries (entity_type, entity_id);
create index if not exists idx_deliveries_created
  on public.notification_deliveries (created_at desc);

alter table public.notification_deliveries enable row level security;
alter table public.notification_recipients enable row level security;

-- payload holds customer names and phone numbers, so reads are restricted to
-- ADMIN/DIRECTOR rather than "any approved user". No INSERT/UPDATE/DELETE
-- policies at all — every write goes through the service-role client.
drop policy if exists deliveries_read on public.notification_deliveries;
create policy deliveries_read on public.notification_deliveries for select
  using ((select public.current_role()) in ('ADMIN','DIRECTOR'));

drop policy if exists recipients_read on public.notification_recipients;
create policy recipients_read on public.notification_recipients for select
  using ((select public.current_role()) in ('ADMIN','DIRECTOR'));
