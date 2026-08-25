-- ===========================================================================
-- 0007 — Repair: bring tickets / ticket_comments up to the 0004 definition
--
-- Run AFTER 0006 (which adds the enum values this file's policies rely on).
--
-- Background: the tables already existed from an earlier draft schema, so the
-- `create table if not exists` in 0004 was a no-op and none of its columns,
-- trigger or policies were applied. Everything here is idempotent, so it is
-- safe to re-run and safe on a database that already got 0004 cleanly.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Missing columns
-- ---------------------------------------------------------------------------
alter table public.tickets add column if not exists page_path text;
alter table public.tickets add column if not exists user_agent text;
alter table public.tickets add column if not exists closed_at timestamptz;
alter table public.tickets add column if not exists last_activity_at timestamptz;

alter table public.ticket_comments add column if not exists author_role user_role;
alter table public.ticket_comments add column if not exists is_internal boolean not null default false;

-- Backfill last_activity_at for rows that predate the column, then enforce the
-- NOT NULL + default the application expects.
update public.tickets
   set last_activity_at = coalesce(last_activity_at, updated_at, created_at, now())
 where last_activity_at is null;

alter table public.tickets alter column last_activity_at set default now();
alter table public.tickets alter column last_activity_at set not null;

-- Backfill author_role from the author's current role so existing comments
-- render correctly, then make it required.
update public.ticket_comments c
   set author_role = u.role
  from public.app_users u
 where c.author_id = u.id
   and c.author_role is null;

-- Any comment whose author was deleted falls back to SM rather than blocking
-- the NOT NULL below.
update public.ticket_comments set author_role = 'SM' where author_role is null;
alter table public.ticket_comments alter column author_role set not null;

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_tickets_status   on public.tickets(status, priority);
create index if not exists idx_tickets_raiser   on public.tickets(raised_by, created_at desc);
create index if not exists idx_tickets_assignee on public.tickets(assigned_to) where assigned_to is not null;
create index if not exists idx_tickets_activity on public.tickets(last_activity_at desc);
create index if not exists idx_ticket_comments  on public.ticket_comments(ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. Activity trigger (needs last_activity_at to exist)
-- ---------------------------------------------------------------------------
create or replace function public.touch_ticket_activity() returns trigger as $$
begin
  update public.tickets
     set last_activity_at = now(), updated_at = now()
   where id = new.ticket_id;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_ticket_comment_touch on public.ticket_comments;
create trigger trg_ticket_comment_touch
after insert on public.ticket_comments
for each row execute function public.touch_ticket_activity();

-- ---------------------------------------------------------------------------
-- 4. RLS (the comments policy references is_internal, which is why 0004
--    aborted here on the drifted schema)
-- ---------------------------------------------------------------------------
create or replace function public.can_view_ticket(t uuid) returns boolean as $$
  select exists (
    select 1 from public.tickets tk
     where tk.id = t
       and ( tk.raised_by = auth.uid()
          or tk.assigned_to = auth.uid()
          or public.current_role() in ('ADMIN','DIRECTOR') )
  );
$$ language sql stable security definer;

alter table public.tickets         enable row level security;
alter table public.ticket_comments enable row level security;

drop policy if exists tickets_read on public.tickets;
create policy tickets_read on public.tickets for select
  using (
    (select public.current_status()) = 'APPROVED'
    and ( raised_by = auth.uid()
       or assigned_to = auth.uid()
       or (select public.current_role()) in ('ADMIN','DIRECTOR') )
  );

drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert
  with check ((select public.current_status()) = 'APPROVED' and raised_by = auth.uid());

drop policy if exists ticket_comments_read on public.ticket_comments;
create policy ticket_comments_read on public.ticket_comments for select
  using (
    public.can_view_ticket(ticket_id)
    and (is_internal = false or (select public.current_role()) in ('ADMIN','DIRECTOR'))
  );

-- ---------------------------------------------------------------------------
-- 5. Realtime (guarded — re-adding a table already in the publication errors)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ticket_comments'
  ) then
    alter publication supabase_realtime add table public.ticket_comments;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Tell PostgREST to reload, so the new columns leave the schema cache
--    ("Could not find the 'page_path' column of 'tickets' in the schema cache")
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
