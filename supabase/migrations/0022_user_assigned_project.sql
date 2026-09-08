-- 0022 — admin-assignable default project per user
-- Allows ADMIN/DIRECTOR to pick a Sri Varaha sub-project (Aurum/Tatva/...)
-- for any login user. Middleware then auto-redirects to that project after
-- login without showing the picker.

alter table public.app_users add column if not exists assigned_project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_app_users_assigned_project on public.app_users(assigned_project_id) where assigned_project_id is not null;

comment on column public.app_users.assigned_project_id is 'Admin-assigned default project; middleware auto-sets srivaraha_project cookie to this on login';

notify pgrst, 'reload schema';
