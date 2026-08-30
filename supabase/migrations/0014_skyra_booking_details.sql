-- Fields captured by the SKYRA booking form. Applicant-specific data lives on
-- customers; sale and property data belongs to the booking.

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

alter table public.bookings add column if not exists sales_representative text;
alter table public.bookings add column if not exists team_manager text;
alter table public.bookings add column if not exists booking_place text;
alter table public.bookings add column if not exists booking_date date;
alter table public.bookings add column if not exists block text;
alter table public.bookings add column if not exists facing text;
alter table public.bookings add column if not exists saleable_area numeric(12,2);
alter table public.bookings add column if not exists carpet_area numeric(12,2);
alter table public.bookings add column if not exists external_walls_area numeric(12,2);
alter table public.bookings add column if not exists balcony_utility_area numeric(12,2);
alter table public.bookings add column if not exists common_area numeric(12,2);
alter table public.bookings add column if not exists base_price numeric(14,2);
alter table public.bookings add column if not exists floor_rise_charges numeric(14,2);
alter table public.bookings add column if not exists east_facing_charges numeric(14,2);
alter table public.bookings add column if not exists premium_view_charges numeric(14,2);
alter table public.bookings add column if not exists amenities_charges numeric(14,2);
alter table public.bookings add column if not exists car_parking_charges numeric(14,2);
alter table public.bookings add column if not exists legal_documentation_charges numeric(14,2);
alter table public.bookings add column if not exists sale_consideration_per_sqft numeric(14,2);
alter table public.bookings add column if not exists source_of_booking text;
alter table public.bookings add column if not exists referral_customer_name text;
alter table public.bookings add column if not exists referral_project_name text;
alter table public.bookings add column if not exists cp_agent_name text;
alter table public.bookings add column if not exists cp_rera_id text;
alter table public.bookings add column if not exists payment_source text;
alter table public.bookings add column if not exists purchase_purpose text;

notify pgrst, 'reload schema';
