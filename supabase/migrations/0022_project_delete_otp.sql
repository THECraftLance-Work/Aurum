create table if not exists public.project_delete_otps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  director_id uuid not null references public.app_users(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_project_delete_otps_project on public.project_delete_otps(project_id, expires_at);
alter table public.project_delete_otps enable row level security;
drop policy if exists pdo_read on public.project_delete_otps;
create policy pdo_read on public.project_delete_otps for select using (director_id = auth.uid());
drop policy if exists pdo_write on public.project_delete_otps;
create policy pdo_write on public.project_delete_otps for all using ((select public.current_role())='DIRECTOR') with check ((select public.current_role())='DIRECTOR');
notify pgrst, 'reload schema';
