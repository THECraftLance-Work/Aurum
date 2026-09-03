-- Repair customer profile columns for databases where the SKYRA migration was
-- only partially applied. IF NOT EXISTS keeps this safe to run repeatedly.
alter table public.customers add column if not exists title text;
alter table public.customers add column if not exists father_spouse_name text;
alter table public.customers add column if not exists date_of_birth date;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists state text;
alter table public.customers add column if not exists country text;
alter table public.customers add column if not exists pin_code text;
alter table public.customers add column if not exists alternate_phone text;
alter table public.customers add column if not exists alternate_email text;
alter table public.customers add column if not exists pan_number text;
alter table public.customers add column if not exists aadhaar_number text;
alter table public.customers add column if not exists occupation text;
alter table public.customers add column if not exists organization text;
alter table public.customers add column if not exists designation text;

notify pgrst, 'reload schema';
