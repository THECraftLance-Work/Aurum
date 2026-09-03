-- Ensure identity fields exist even when the earlier SKYRA migration was not
-- applied to an existing project database.
alter table public.customers add column if not exists pan_number text;
alter table public.customers add column if not exists aadhaar_number text;

notify pgrst, 'reload schema';
