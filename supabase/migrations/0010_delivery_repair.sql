-- ===========================================================================
-- 0010 — Repair notification_deliveries to match the 0005 definition
--
-- Run AFTER 0009 (which adds the SENDING status this worker relies on).
--
-- Root cause: the table already existed from an earlier draft schema, so the
-- `create table if not exists` in 0005 was a no-op and nine columns were never
-- created — including event_key and dedupe_key, both of which enqueueOutbound()
-- writes. Every insert was therefore failing, the table stayed empty, and no
-- email was ever attempted. (enqueue logs and swallows the error by design, so
-- a booking still succeeds — which is why this was silent.)
--
-- Idempotent: safe to re-run, and safe on a database that got 0005 cleanly.
-- ===========================================================================

alter table public.notification_deliveries add column if not exists event_key text;
alter table public.notification_deliveries add column if not exists provider text;
alter table public.notification_deliveries add column if not exists template_name text;
alter table public.notification_deliveries add column if not exists subject text;
alter table public.notification_deliveries add column if not exists max_attempts int;
alter table public.notification_deliveries add column if not exists error_code text;
alter table public.notification_deliveries add column if not exists error_message text;
alter table public.notification_deliveries add column if not exists dedupe_key text;
alter table public.notification_deliveries add column if not exists sent_at timestamptz;

-- Backfill, then apply the defaults/NOT NULLs the application expects.
update public.notification_deliveries set provider     = 'pending' where provider is null;
update public.notification_deliveries set max_attempts = 3         where max_attempts is null;
update public.notification_deliveries set event_key    = 'UNKNOWN' where event_key is null;

alter table public.notification_deliveries alter column provider     set default 'pending';
alter table public.notification_deliveries alter column provider     set not null;
alter table public.notification_deliveries alter column max_attempts set default 3;
alter table public.notification_deliveries alter column max_attempts set not null;
alter table public.notification_deliveries alter column event_key    set not null;

-- dedupe_key is what makes enqueue idempotent: re-running an enqueue for the
-- same (event, entity, channel, recipient) must not produce a second message.
-- upsert(onConflict: "dedupe_key") requires a UNIQUE constraint, not just an index.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'notification_deliveries_dedupe_key_key'
       and conrelid = 'public.notification_deliveries'::regclass
  ) then
    -- Clear any duplicate/blank keys first so the constraint can be created.
    update public.notification_deliveries
       set dedupe_key = coalesce(dedupe_key, id::text)
     where dedupe_key is null;

    alter table public.notification_deliveries
      add constraint notification_deliveries_dedupe_key_key unique (dedupe_key);
  end if;
end $$;

create index if not exists idx_deliveries_due
  on public.notification_deliveries (next_attempt_at)
  where status in ('QUEUED','FAILED');
create index if not exists idx_deliveries_entity
  on public.notification_deliveries (entity_type, entity_id);
create index if not exists idx_deliveries_created
  on public.notification_deliveries (created_at desc);

-- RLS: reads are ADMIN/DIRECTOR only (payload carries customer names and phone
-- numbers). No insert/update/delete policies — all writes go through the
-- service-role client.
alter table public.notification_deliveries enable row level security;

drop policy if exists deliveries_read on public.notification_deliveries;
create policy deliveries_read on public.notification_deliveries for select
  using ((select public.current_role()) in ('ADMIN','DIRECTOR'));

-- Clear PostgREST's cached schema so the new columns are visible immediately.
notify pgrst, 'reload schema';
