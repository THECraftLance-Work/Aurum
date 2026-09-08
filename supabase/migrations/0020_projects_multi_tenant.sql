-- 0020 — SRI VARAHA multi-project: parent Sri Varaha, sub-projects Aurum/Tatva, per-project data isolation.
-- ADMIN can create projects, DIRECTOR can delete (with app-level 4-step verification).
-- Existing bookings/payments without project_id will be assigned to the default Aurum project by the app after migration.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  parent_id uuid references public.projects(id) on delete set null,
  is_active boolean not null default true,
  default_sale_consideration numeric(15,2),
  default_areas jsonb not null default '{}'::jsonb,
  total_value_formula text,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  project_role user_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Add project scoping to bookings/payments/audit if not exists
alter table public.bookings add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.payments add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.audit_logs add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_projects_parent on public.projects(parent_id) where parent_id is not null;
create index if not exists idx_projects_slug on public.projects(slug);
create index if not exists idx_bookings_project on public.bookings(project_id) where project_id is not null;
create index if not exists idx_payments_project on public.payments(project_id) where project_id is not null;
create index if not exists idx_project_members_user on public.project_members(user_id);
create index if not exists idx_audit_project on public.audit_logs(project_id) where project_id is not null;

-- Seed parent Sri Varaha + default Aurum if not exists (idempotent)
do $$
declare
  parent uuid;
  aurum uuid;
begin
  insert into public.projects(slug, name, is_active)
  values ('sri-varaha','Sri Varaha', true)
  on conflict (slug) do update set name = excluded.name
  returning id into parent;

  -- if conflict, re-select id
  if parent is null then select id into parent from public.projects where slug='sri-varaha'; end if;

  insert into public.projects(slug, name, parent_id, is_active)
  values ('aurum','Aurum', parent, true)
  on conflict (slug) do nothing;

  insert into public.projects(slug, name, parent_id, is_active)
  values ('tatva','Tatva', parent, true)
  on conflict (slug) do nothing;

  -- Backfill existing bookings without project to Aurum
  select id into aurum from public.projects where slug='aurum';
  update public.bookings set project_id = aurum where project_id is null;
  update public.payments set project_id = aurum where project_id is null;
end $$;

-- RLS: projects readable by any approved user where is_active or admin/director
alter table public.projects enable row level security;
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select
  using ( (select public.current_status()) = 'APPROVED' );

drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for insert
  with check ( (select public.current_role()) in ('ADMIN','DIRECTOR') );

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update
  using ( (select public.current_role()) in ('ADMIN','DIRECTOR') );

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete
  using ( (select public.current_role()) = 'DIRECTOR' );

alter table public.project_members enable row level security;
drop policy if exists pm_read on public.project_members;
create policy pm_read on public.project_members for select using ( (select public.current_status())='APPROVED' );
drop policy if exists pm_write on public.project_members;
create policy pm_write on public.project_members for all using ( (select public.current_role()) in ('ADMIN','DIRECTOR') ) with check ( (select public.current_role()) in ('ADMIN','DIRECTOR') );

notify pgrst, 'reload schema';
