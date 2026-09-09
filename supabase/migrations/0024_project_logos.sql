-- Store an optional public logo for each project.
alter table public.projects add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('project-logos', 'project-logos', true)
on conflict (id) do update set public = true;

drop policy if exists project_logos_read on storage.objects;
create policy project_logos_read on storage.objects for select
  using (bucket_id = 'project-logos');

drop policy if exists project_logos_admin_write on storage.objects;
create policy project_logos_admin_write on storage.objects for all
  using (bucket_id = 'project-logos' and (select public.current_role()) in ('ADMIN', 'DIRECTOR'))
  with check (bucket_id = 'project-logos' and (select public.current_role()) in ('ADMIN', 'DIRECTOR'));
