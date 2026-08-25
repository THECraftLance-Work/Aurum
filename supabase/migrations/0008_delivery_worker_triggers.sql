-- ===========================================================================
-- 0008 — Trigger the outbound delivery worker
--
--   * Database Webhook : fires the Edge Function the moment rows are enqueued
--   * pg_cron          : every 5 minutes, the durable retry safety net
--
-- Both authenticate with the service-role key against the Edge Function's own
-- JWT verification, so there is no separate shared secret to manage.
--
-- PREREQUISITE — store the two values in Vault first (Dashboard → Settings →
-- Vault, or run this once, substituting your own values):
--
--   select vault.create_secret(
--     'https://YOUR-PROJECT-REF.supabase.co/functions/v1/dispatch-notifications',
--     'delivery_worker_url',
--     'Outbound delivery worker endpoint'
--   );
--   select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key', 'Service role key for pg_net calls');
--
-- Never inline the service-role key in migration SQL — migrations get committed.
-- ===========================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Shared caller. Returns quietly when the Vault secrets are absent, so a fresh
-- clone doesn't error on every insert before setup is done.
-- ---------------------------------------------------------------------------
create or replace function public.call_delivery_worker() returns void as $$
declare
  worker_url text;
  svc_key    text;
begin
  select decrypted_secret into worker_url
    from vault.decrypted_secrets where name = 'delivery_worker_url' limit 1;
  select decrypted_secret into svc_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if worker_url is null or svc_key is null then
    raise notice 'call_delivery_worker: Vault secrets not configured, skipping';
    return;
  end if;

  perform net.http_post(
    url     := worker_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || svc_key
               ),
    body    := jsonb_build_object('source', 'postgres'),
    timeout_milliseconds := 5000
  );
end;
$$ language plpgsql security definer set search_path = public, extensions, vault;

revoke all on function public.call_delivery_worker() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Webhook: fire as soon as deliveries are enqueued.
--
-- FOR EACH STATEMENT, not FOR EACH ROW — enqueueOutbound() inserts one batch
-- covering every recipient and channel, so this makes a single HTTP call per
-- booking/payment rather than one per recipient.
--
-- The worker drains the whole due queue regardless of what triggered it, so it
-- does not need to know which rows were just inserted.
-- ---------------------------------------------------------------------------
create or replace function public.on_delivery_enqueued() returns trigger as $$
begin
  perform public.call_delivery_worker();
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_delivery_enqueued on public.notification_deliveries;
create trigger trg_delivery_enqueued
after insert on public.notification_deliveries
for each statement execute function public.on_delivery_enqueued();

-- ---------------------------------------------------------------------------
-- Cron: retries and anything the webhook missed.
-- pg_cron is enabled on every Supabase tier, so this needs no paid plan.
-- ---------------------------------------------------------------------------
do $$
begin
  -- unschedule() throws if the job doesn't exist, so guard it
  if exists (select 1 from cron.job where jobname = 'drain-notification-deliveries') then
    perform cron.unschedule('drain-notification-deliveries');
  end if;
end $$;

select cron.schedule(
  'drain-notification-deliveries',
  '*/5 * * * *',
  $$ select public.call_delivery_worker(); $$
);
