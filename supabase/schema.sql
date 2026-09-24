-- Vivienda: full database setup.
-- Paste this whole file into Supabase → SQL Editor → Run. It is safe to re-run.
-- Then run the last block (bottom of file) with the owner's email to make her the admin.

create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists public.admins (
  email text primary key
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  resort_name text not null default 'Vivienda',
  tagline text default 'A quiet place to stay',
  about text default '',
  email text default '',
  phone text default '',
  address text default '',
  facebook_url text default '',
  map_url text default '',
  check_in_time text not null default '14:00',
  check_out_time text not null default '12:00',
  downpayment_percent int not null default 50 check (downpayment_percent between 0 and 100),
  gcash_name text default '',
  gcash_number text default '',
  bank_name text default '',
  bank_account_name text default '',
  bank_account_number text default '',
  payment_instructions text default 'Send your downpayment and upload the receipt. We confirm bookings within 24 hours.',
  house_rules text default '',
  cancellation_policy text default '',
  waiver text default '',
  send_emails boolean not null default true,
  admin_notify_email text default '',
  reminder_days_before int not null default 2 check (reminder_days_before between 0 and 14),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text default '',
  capacity int not null default 2 check (capacity > 0),
  max_guests int not null default 4 check (max_guests > 0),
  base_rate numeric(12,2) not null default 0 check (base_rate >= 0),
  weekend_rate numeric(12,2) check (weekend_rate >= 0),
  extra_guest_fee numeric(12,2) not null default 0 check (extra_guest_fee >= 0),
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (max_guests >= capacity)
);

create table if not exists public.rate_overrides (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  date date not null,
  rate numeric(12,2) not null check (rate >= 0),
  unique (unit_id, date)
);

create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  date date not null,
  reason text default '',
  unique (unit_id, date)
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  notes text default '',
  created_at timestamptz not null default now()
);
create unique index if not exists guests_email_key on public.guests (lower(email)) where email is not null and email <> '';

create or replace function public.gen_booking_ref() returns text
language plpgsql volatile as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text;
begin
  loop
    out := 'VIV-';
    for i in 1..6 loop
      out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where ref = out);
  end loop;
  return out;
end $$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  unit_id uuid not null references public.units(id) on delete restrict,
  guest_id uuid not null references public.guests(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guests_count int not null default 1 check (guests_count > 0),
  status text not null default 'pending'
    check (status in ('pending','confirmed','checked_in','checked_out','cancelled','declined')),
  source text not null default 'website'
    check (source in ('website','facebook','walk_in','phone','other')),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  payment_method text,
  receipt_path text,
  special_requests text default '',
  admin_notes text default '',
  waiver_accepted_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  -- Two live bookings can never hold the same unit on the same night.
  constraint bookings_no_overlap exclude using gist (
    unit_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status in ('pending','confirmed','checked_in'))
);
alter table public.bookings alter column ref set default public.gen_booking_ref();
create index if not exists bookings_dates_idx on public.bookings (check_in, check_out);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null default 'payment' check (kind in ('payment','refund')),
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'gcash' check (method in ('gcash','bank_transfer','cash','card','other')),
  paid_on date not null default current_date,
  reference text default '',
  notes text default '',
  created_at timestamptz not null default now()
);
create index if not exists payments_paid_on_idx on public.payments (paid_on);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  category text not null default 'other',
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  vendor text default '',
  notes text default '',
  created_at timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on);

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  type text not null,
  to_email text not null,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- Booking with guest, unit, and what has been paid. Respects the caller's RLS.
create or replace view public.booking_summary with (security_invoker = on) as
select
  b.*,
  g.full_name as guest_name,
  g.email as guest_email,
  g.phone as guest_phone,
  u.name as unit_name,
  (b.check_out - b.check_in) as nights,
  coalesce(p.paid, 0)::numeric(12,2) as paid,
  (b.total - coalesce(p.paid, 0))::numeric(12,2) as balance
from public.bookings b
join public.guests g on g.id = b.guest_id
join public.units u on u.id = b.unit_id
left join (
  select booking_id,
         sum(case when kind = 'refund' then -amount else amount end) as paid
  from public.payments group by booking_id
) p on p.booking_id = b.id;

-- ─────────────────────────────────────────────────────────────
-- Admin check + row level security
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.units enable row level security;
alter table public.rate_overrides enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.guests enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.email_log enable row level security;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists units_read on public.units;
create policy units_read on public.units for select using (is_active or public.is_admin());
drop policy if exists units_write on public.units;
create policy units_write on public.units for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists rates_read on public.rate_overrides;
create policy rates_read on public.rate_overrides for select using (true);
drop policy if exists rates_write on public.rate_overrides;
create policy rates_write on public.rate_overrides for all using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['blocked_dates','guests','bookings','payments','expenses','email_log'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Public functions: the only way guests touch bookings
-- ─────────────────────────────────────────────────────────────

-- Price for a stay. Per night: a date override wins, then the weekend rate
-- (Friday and Saturday nights), then the base rate. Guests above capacity pay
-- the extra guest fee per night.
create or replace function public.quote_stay(p_unit uuid, p_check_in date, p_check_out date, p_guests int)
returns table (nights int, room_total numeric, extra_guest_total numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  u public.units;
  n int;
  rooms numeric := 0;
  extra numeric := 0;
begin
  select * into u from public.units where id = p_unit;
  if not found then raise exception 'Unit not found'; end if;
  if p_check_out <= p_check_in then raise exception 'Check-out must be after check-in'; end if;
  n := p_check_out - p_check_in;

  select coalesce(sum(
    coalesce(r.rate,
      case when extract(isodow from d) in (5, 6) and u.weekend_rate is not null then u.weekend_rate else u.base_rate end)
  ), 0) into rooms
  from generate_series(p_check_in, p_check_out - 1, interval '1 day') as g(d)
  left join public.rate_overrides r on r.unit_id = u.id and r.date = g.d::date;

  extra := greatest(coalesce(p_guests, 1) - u.capacity, 0) * u.extra_guest_fee * n;
  return query select n, rooms, extra, rooms + extra;
end $$;

-- Nights a unit cannot be booked (live bookings + blocked dates). No guest data leaves.
create or replace function public.unavailable_nights(p_unit uuid, p_from date, p_to date)
returns setof date
language sql stable security definer set search_path = public as $$
  select distinct d from (
    select generate_series(greatest(b.check_in, p_from), least(b.check_out - 1, p_to), interval '1 day')::date as d
    from public.bookings b
    where b.unit_id = p_unit
      and b.status in ('pending','confirmed','checked_in')
      and b.check_in <= p_to and b.check_out > p_from
    union all
    select bd.date from public.blocked_dates bd
    where bd.unit_id = p_unit and bd.date between p_from and p_to
  ) x order by 1;
$$;

create or replace function public.create_booking(
  p_unit uuid,
  p_check_in date,
  p_check_out date,
  p_guests int,
  p_full_name text,
  p_email text,
  p_phone text,
  p_special_requests text,
  p_payment_method text,
  p_receipt_path text,
  p_waiver_accepted boolean
) returns table (id uuid, ref text, total numeric)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  u public.units;
  q record;
  gid uuid;
  new_id uuid;
  new_ref text;
begin
  select * into u from public.units where units.id = p_unit and is_active;
  if not found then raise exception 'That unit is not available for booking.'; end if;
  if p_check_in < (now() at time zone 'Asia/Manila')::date then raise exception 'Check-in cannot be in the past.'; end if;
  if p_check_out <= p_check_in then raise exception 'Check-out must be after check-in.'; end if;
  if p_check_out - p_check_in > 60 then raise exception 'Stays longer than 60 nights need to be arranged with us directly.'; end if;
  if p_guests < 1 or p_guests > u.max_guests then
    raise exception 'This unit fits up to % guests.', u.max_guests;
  end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Please enter your name.'; end if;
  if coalesce(trim(p_email), '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email.'; end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'Please enter a mobile number.'; end if;
  if not coalesce(p_waiver_accepted, false) then raise exception 'Please accept the guest agreement.'; end if;
  if p_payment_method is not null and p_payment_method not in ('gcash','bank_transfer','cash','card','other') then
    raise exception 'Unknown payment method.';
  end if;
  if exists (select 1 from public.unavailable_nights(p_unit, p_check_in, p_check_out - 1)) then
    raise exception 'Sorry, some of those nights were just taken. Please pick other dates.';
  end if;

  select * into q from public.quote_stay(p_unit, p_check_in, p_check_out, p_guests);

  insert into public.guests (full_name, email, phone)
  values (trim(p_full_name), lower(trim(p_email)), trim(p_phone))
  on conflict (lower(email)) where email is not null and email <> ''
  do update set phone = coalesce(nullif(guests.phone, ''), excluded.phone)
  returning guests.id into gid;

  begin
    insert into public.bookings (unit_id, guest_id, check_in, check_out, guests_count, status, source,
                                 subtotal, total, payment_method, receipt_path, special_requests, waiver_accepted_at)
    values (p_unit, gid, p_check_in, p_check_out, p_guests, 'pending', 'website',
            q.total, q.total, p_payment_method, nullif(p_receipt_path, ''), coalesce(p_special_requests, ''), now())
    returning bookings.id, bookings.ref into new_id, new_ref;
  exception when exclusion_violation then
    raise exception 'Sorry, some of those nights were just taken. Please pick other dates.';
  end;

  return query select new_id, new_ref, q.total;
end $$;

-- What a guest may see about their own booking: needs both the reference and the email.
create or replace function public.booking_status(p_ref text, p_email text)
returns table (ref text, status text, unit_name text, check_in date, check_out date,
               guests_count int, total numeric, paid numeric, balance numeric, guest_name text)
language sql stable security definer set search_path = public as $$
  select s.ref, s.status, s.unit_name, s.check_in, s.check_out, s.guests_count,
         s.total, s.paid, s.balance, s.guest_name
  from public.booking_summary s
  where upper(s.ref) = upper(trim(p_ref)) and lower(s.guest_email) = lower(trim(p_email));
$$;

revoke all on function public.create_booking(uuid, date, date, int, text, text, text, text, text, text, boolean) from public;
grant execute on function public.create_booking(uuid, date, date, int, text, text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.quote_stay(uuid, date, date, int) to anon, authenticated;
grant execute on function public.unavailable_nights(uuid, date, date) to anon, authenticated;
grant execute on function public.booking_status(text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage: receipts are private (guests upload, admin reads);
-- unit photos are public (admin uploads).
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unit-photos', 'unit-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists receipts_upload on storage.objects;
create policy receipts_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'receipts');
drop policy if exists receipts_admin on storage.objects;
create policy receipts_admin on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_admin());
drop policy if exists receipts_admin_delete on storage.objects;
create policy receipts_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_admin());

drop policy if exists unit_photos_read on storage.objects;
create policy unit_photos_read on storage.objects for select
  using (bucket_id = 'unit-photos');
drop policy if exists unit_photos_write on storage.objects;
create policy unit_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'unit-photos' and public.is_admin());
drop policy if exists unit_photos_delete on storage.objects;
create policy unit_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'unit-photos' and public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Make the owner the admin. Replace the email, then run this line.
-- She also needs a login: Authentication → Users → Add user (same email).
-- ─────────────────────────────────────────────────────────────
-- insert into public.admins (email) values ('owner@example.com') on conflict do nothing;
