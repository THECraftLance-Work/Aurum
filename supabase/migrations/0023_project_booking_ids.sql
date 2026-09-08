-- 0023 — independent booking numbering per project and calendar year.
-- Existing booking IDs remain unchanged; only newly-created bookings use this
-- format: AURUM-26-00001, TATVA-26-00001, etc.

create table if not exists public.project_booking_counters (
  project_id uuid not null references public.projects(id) on delete cascade,
  booking_year integer not null,
  last_number bigint not null default 0,
  primary key (project_id, booking_year)
);

create or replace function public.generate_project_booking_id()
returns trigger
language plpgsql
as $$
declare
  project_slug text;
  booking_year integer := extract(year from current_date)::integer;
  next_number bigint;
begin
  if new.project_id is null then
    raise exception 'project_id is required for a booking';
  end if;

  select upper(regexp_replace(slug, '[^a-zA-Z0-9]', '', 'g'))
    into project_slug
    from public.projects
   where id = new.project_id
     and is_active = true;

  if project_slug is null then
    raise exception 'active project not found for booking';
  end if;

  insert into public.project_booking_counters (project_id, booking_year, last_number)
  values (new.project_id, booking_year, 1)
  on conflict (project_id, booking_year)
  do update set last_number = public.project_booking_counters.last_number + 1
  returning last_number into next_number;

  new.booking_id := project_slug || '-' ||
    right(booking_year::text, 2) || '-' ||
    lpad(next_number::text, 5, '0');
  return new;
end;
$$;

alter table public.bookings alter column booking_id drop default;

drop trigger if exists trg_project_booking_id on public.bookings;
create trigger trg_project_booking_id
before insert on public.bookings
for each row execute function public.generate_project_booking_id();

notify pgrst, 'reload schema';
