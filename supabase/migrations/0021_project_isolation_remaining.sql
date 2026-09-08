-- 0021 — isolate inbox/notifications, tickets/support, analytics/history per project
alter table public.notifications add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.tickets add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_notifications_project on public.notifications(project_id) where project_id is not null;
create index if not exists idx_tickets_project on public.tickets(project_id) where project_id is not null;

-- Backfill to Aurum for existing rows
do $$
declare aurum uuid;
begin
  select id into aurum from public.projects where slug='aurum';
  if aurum is not null then
    update public.notifications set project_id = aurum where project_id is null;
    update public.tickets set project_id = aurum where project_id is null;
  end if;
end $$;

notify pgrst, 'reload schema';
