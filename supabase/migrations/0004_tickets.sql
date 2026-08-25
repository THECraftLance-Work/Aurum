-- ===========================================================================
-- 0004 — Support tickets ("Raise Ticket", available to every role)
-- Requires 0003 to have been applied first.
-- ===========================================================================

do $$ begin
  create type ticket_status as enum ('OPEN','IN_PROGRESS','WAITING_ON_USER','RESOLVED','CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_priority as enum ('LOW','NORMAL','HIGH','URGENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_category as enum (
    'BUG','ACCESS','DATA_CORRECTION','BOOKING_ISSUE','PAYMENT_ISSUE','FEATURE_REQUEST','OTHER'
  );
exception when duplicate_object then null; end $$;

-- Mirrors generate_booking_id(). Note nextval() is non-transactional, so a
-- failed insert burns a number and gaps are expected — same as booking_id.
create sequence if not exists ticket_id_seq start 1;

create or replace function public.generate_ticket_number() returns text as $$
declare
  yy text := to_char(now(), 'YY');
  nxt bigint;
begin
  nxt := nextval('ticket_id_seq');
  return 'TKT-' || yy || lpad(nxt::text, 5, '0');
end;
$$ language plpgsql;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default public.generate_ticket_number(),
  raised_by uuid not null references public.app_users(id) on delete restrict,
  raiser_role user_role not null,
  category ticket_category not null default 'OTHER',
  priority ticket_priority not null default 'NORMAL',
  status   ticket_status   not null default 'OPEN',
  subject     text not null check (char_length(subject) between 3 and 160),
  description text not null check (char_length(description) between 5 and 5000),
  page_path  text,                        -- auto-captured: which screen they were on
  user_agent text,
  related_entity_type text,               -- 'booking' | 'payment' | null
  related_entity_id   uuid,
  assigned_to uuid references public.app_users(id),
  resolution_note text,
  resolved_by uuid references public.app_users(id),
  resolved_at timestamptz,
  closed_at   timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_tickets_status   on public.tickets(status, priority);
create index if not exists idx_tickets_raiser   on public.tickets(raised_by, created_at desc);
create index if not exists idx_tickets_assignee on public.tickets(assigned_to) where assigned_to is not null;
create index if not exists idx_tickets_activity on public.tickets(last_activity_at desc);

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references public.app_users(id),
  author_role user_role not null,
  body text not null check (char_length(body) between 1 and 4000),
  is_internal boolean not null default false,  -- staff triage note, hidden from raiser
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_comments on public.ticket_comments(ticket_id, created_at);

-- Bump parent activity on reply (same pattern as recalc_booking_totals)
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

-- Defence in depth; real inserts go through the service-role API route.
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert
  with check ((select public.current_status()) = 'APPROVED' and raised_by = auth.uid());

-- Deliberately NO update/delete policy: status, assignment and resolution are
-- service-role only, matching how notifications and audit_logs are handled.

drop policy if exists ticket_comments_read on public.ticket_comments;
create policy ticket_comments_read on public.ticket_comments for select
  using (
    public.can_view_ticket(ticket_id)
    and (is_internal = false or (select public.current_role()) in ('ADMIN','DIRECTOR'))
  );

alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.ticket_comments;
