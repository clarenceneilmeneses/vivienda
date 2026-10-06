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
  tagline text default 'Our Tropical Haven',
  about text default 'Relax, unwind, and enjoy exclusive access to our private pool. Designed for comfort, cleanliness, and peace of mind—your personal oasis awaits. Experience serenity, comfortable lounging spaces, and a tranquil atmosphere that create the perfect escape.',
  email text default 'vivienda.ivorygem@gmail.com',
  phone text default '0995 496 6063',
  address text default 'Muzon 1st, Alitagtag, Philippines, 4205',
  facebook_url text default 'https://www.facebook.com/profile.php?id=61583823161485',
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
-- A guest with a website account. One account, one guest record.
alter table public.guests add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists guests_user_key on public.guests (user_id) where user_id is not null;

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

  -- Booked while signed in with the same email: the booking joins the account,
  -- and the request shows up in the guest's conversation, as on Airbnb.
  if auth.uid() is not null and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(trim(p_email)) then
    update public.guests set user_id = auth.uid() where guests.id = gid and user_id is null
      and not exists (select 1 from public.guests g2 where g2.user_id = auth.uid());
    if exists (select 1 from public.guests g3 where g3.id = gid and g3.user_id = auth.uid()) then
      perform public.post_booking_note(gid, new_id,
        format('Requested to book %s – %s for %s guest%s.',
          to_char(p_check_in, 'Mon DD'), to_char(p_check_out, 'Mon DD, YYYY'), p_guests,
          case when p_guests = 1 then '' else 's' end));
    end if;
  end if;

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
-- Guest accounts, messages and reviews (the Airbnb-style guest side)
--
-- One conversation per guest, for life: inquiry, booking, stay and after.
-- Guests never read tables directly; they get their own rows through the
-- functions below, so admin notes and other guests' data never leave.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.guests(id) on delete cascade,
  starred boolean not null default false,
  archived_at timestamptz,
  admin_unread boolean not null default false,
  admin_seen_at timestamptz,
  guest_seen_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_author text,
  -- What the guest had picked on the site when they pressed "Message host".
  inquiry_check_in date,
  inquiry_check_out date,
  inquiry_guests int,
  -- When each side was last emailed about new messages, so a burst is one email.
  host_emailed_at timestamptz,
  guest_emailed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.conversations add column if not exists host_emailed_at timestamptz;
alter table public.conversations add column if not exists guest_emailed_at timestamptz;
create index if not exists conversations_last_idx on public.conversations (last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author text not null check (author in ('guest','host')),
  author_name text not null default '',
  -- message: typed by a person. problem: a guest reporting an issue during the stay.
  -- booking: a note the system posts when a booking is requested, cancelled or paid.
  kind text not null default 'message' check (kind in ('message','problem','booking')),
  body text not null default '',
  booking_id uuid references public.bookings(id) on delete set null,
  edited_at timestamptz,
  unsent_at timestamptz,
  sent_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, sent_at);

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null,
  status text not null default 'pending' check (status in ('pending','published','hidden')),
  host_reply text not null default '',
  host_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

-- A few saved answers to start with. Edit them in the admin under Inbox → Quick replies.
insert into public.quick_replies (title, body, sort_order)
select * from (values
  ('Thanks for asking', 'Hi {guest}! Thanks for messaging {resort}. Let me check that for you, I''ll get back to you shortly.', 0),
  ('Payment details', 'Hi {guest}! To secure your dates, please send the downpayment via GCash or bank transfer (details are on your booking page under Trips) and upload the receipt there. We confirm within 24 hours.', 1),
  ('Check-in and out', 'Check-in is from 2:00 PM and check-out is until 12:00 noon. Early check-in or late check-out can be arranged if the dates around yours are free.', 2),
  ('Directions', 'We''re at Muzon 1st, Alitagtag, Batangas. Search "Vivienda Resort Alitagtag" on Google Maps or Waze. Call us when you reach the town proper and we''ll guide you in.', 3),
  ('Booking confirmed', 'Hi {guest}! Your booking is confirmed. We''re excited to host you at {resort}. Message us here anytime if you need anything before your stay.', 4),
  ('Thanks for staying', 'Thank you for staying with us, {guest}! We hope you had a relaxing time. If you have a minute, we''d love a review from your Trips page. Hope to see you again!', 5)
) as v(title, body, sort_order)
where not exists (select 1 from public.quick_replies);

-- Keeps the inbox list current: latest message, who wrote it, unread for the host.
create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set
    last_message_at = new.sent_at,
    last_message_preview = left(new.body, 160),
    last_author = new.author,
    admin_unread = (new.author = 'guest'),
    admin_seen_at = case when new.author = 'host' then now() else admin_seen_at end,
    archived_at = case when new.author = 'guest' then null else archived_at end
  where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.quick_replies enable row level security;
alter table public.reviews enable row level security;

create or replace function public.current_guest_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.guests where user_id = auth.uid() limit 1;
$$;

do $$
declare t text;
begin
  foreach t in array array['conversations','messages','quick_replies','reviews'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- Guests read their own thread. They write only through guest_send_message.
drop policy if exists conversations_guest on public.conversations;
create policy conversations_guest on public.conversations for select to authenticated
  using (guest_id = public.current_guest_id());
drop policy if exists messages_guest on public.messages;
create policy messages_guest on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and c.guest_id = public.current_guest_id()));

-- Live updates for the chat. Realtime respects the policies above.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.conversations;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- Signs a guest's account up to their guest record, or updates it. An account
-- picks up earlier bookings made with the same email only once that email is
-- confirmed, so nobody can sign up as someone else and see their stays.
create or replace function public.guest_save_profile(p_full_name text, p_phone text)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  em text;
  confirmed timestamptz;
  gid uuid;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if public.is_admin() then raise exception 'Admin accounts are not guest accounts.'; end if;
  select lower(u.email), u.email_confirmed_at into em, confirmed from auth.users u where u.id = uid;

  select id into gid from public.guests where user_id = uid;
  if gid is null and confirmed is not null then
    update public.guests set user_id = uid
    where lower(email) = em and user_id is null
    returning id into gid;
  end if;

  if gid is null then
    if exists (select 1 from public.guests where lower(email) = em) then
      raise exception 'Please confirm your email first. We sent you a link when you signed up.';
    end if;
    insert into public.guests (full_name, email, phone, user_id)
    values (coalesce(nullif(trim(p_full_name), ''), split_part(em, '@', 1)), em, nullif(trim(p_phone), ''), uid)
    returning id into gid;
  else
    update public.guests set
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = coalesce(nullif(trim(p_phone), ''), phone)
    where id = gid;
  end if;
  return gid;
end $$;

create or replace function public.my_profile()
returns table (id uuid, full_name text, email text, phone text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.full_name, g.email, g.phone, g.created_at from public.guests g where g.user_id = auth.uid();
$$;

-- The guest's trips. No admin notes, no other guests.
create or replace function public.my_bookings()
returns table (id uuid, ref text, status text, unit_name text, unit_slug text, unit_photo text,
               check_in date, check_out date, nights int, guests_count int,
               total numeric, paid numeric, balance numeric, payment_method text, has_receipt boolean,
               special_requests text, created_at timestamptz,
               review_rating int, review_body text, review_status text, review_reply text)
language sql stable security definer set search_path = public as $$
  select s.id, s.ref, s.status, s.unit_name, u.slug, u.photos[1],
         s.check_in, s.check_out, s.nights, s.guests_count,
         s.total, s.paid, s.balance, s.payment_method, s.receipt_path is not null,
         s.special_requests, s.created_at,
         r.rating, r.body, r.status, r.host_reply
  from public.booking_summary s
  join public.units u on u.id = s.unit_id
  left join public.reviews r on r.booking_id = s.id
  where s.guest_id = public.current_guest_id()
  order by s.check_in desc;
$$;

create or replace function public.my_payments(p_booking uuid)
returns table (kind text, amount numeric, method text, paid_on date)
language sql stable security definer set search_path = public as $$
  select p.kind, p.amount, p.method, p.paid_on
  from public.payments p join public.bookings b on b.id = p.booking_id
  where p.booking_id = p_booking and b.guest_id = public.current_guest_id()
  order by p.paid_on;
$$;

-- Posts a system note into a guest's thread, creating the thread if needed.
create or replace function public.post_booking_note(p_guest uuid, p_booking uuid, p_body text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare cid uuid; gname text;
begin
  insert into public.conversations (guest_id) values (p_guest)
  on conflict (guest_id) do nothing;
  select c.id into cid from public.conversations c where c.guest_id = p_guest;
  select full_name into gname from public.guests where id = p_guest;
  insert into public.messages (conversation_id, author, author_name, kind, body, booking_id)
  values (cid, 'guest', coalesce(gname, ''), 'booking', p_body, p_booking);
end $$;
revoke all on function public.post_booking_note(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.guest_send_message(
  p_body text,
  p_kind text default 'message',
  p_check_in date default null,
  p_check_out date default null,
  p_guests int default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  gid uuid := public.current_guest_id();
  gname text;
  cid uuid;
  mid uuid;
  v_body text := trim(coalesce(p_body, ''));
begin
  if gid is null then raise exception 'Finish setting up your account to send messages.'; end if;
  if v_body = '' then raise exception 'Write a message first.'; end if;
  if length(v_body) > 4000 then raise exception 'That message is too long. Please split it up.'; end if;
  if p_kind not in ('message','problem') then raise exception 'Unknown message type.'; end if;
  if p_kind = 'problem' and not exists (
    select 1 from public.bookings where guest_id = gid and status = 'checked_in') then
    raise exception 'You can report a problem while you are staying with us.';
  end if;

  insert into public.conversations (guest_id) values (gid) on conflict (guest_id) do nothing;
  select id into cid from public.conversations where guest_id = gid;

  if (select count(*) from public.messages
      where conversation_id = cid and author = 'guest' and sent_at > now() - interval '10 minutes') >= 30 then
    raise exception 'You are sending messages too fast. Please wait a few minutes.';
  end if;

  if p_check_in is not null and p_check_out is not null and p_check_out > p_check_in then
    update public.conversations set inquiry_check_in = p_check_in, inquiry_check_out = p_check_out,
      inquiry_guests = p_guests where id = cid;
  end if;

  select full_name into gname from public.guests where id = gid;
  insert into public.messages (conversation_id, author, author_name, kind, body)
  values (cid, 'guest', gname, p_kind, v_body)
  returning id into mid;
  update public.conversations set guest_seen_at = now() where id = cid;
  return mid;
end $$;

create or replace function public.guest_mark_seen() returns void
language sql volatile security definer set search_path = public as $$
  update public.conversations set guest_seen_at = now() where guest_id = public.current_guest_id();
$$;

-- A guest may withdraw a request we have not confirmed yet.
create or replace function public.guest_cancel_booking(p_booking uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and guest_id = public.current_guest_id();
  if not found then raise exception 'Booking not found.'; end if;
  if b.status <> 'pending' then
    raise exception 'This booking is already confirmed. Message us to change or cancel it.';
  end if;
  update public.bookings set status = 'cancelled' where id = b.id;
  perform public.post_booking_note(b.guest_id, b.id, format('Withdrew booking request %s.', b.ref));
end $$;

-- Proof of payment sent after booking ("Pay later", or the balance).
create or replace function public.guest_attach_receipt(p_booking uuid, p_path text, p_method text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and guest_id = public.current_guest_id();
  if not found then raise exception 'Booking not found.'; end if;
  if b.status not in ('pending','confirmed','checked_in') then raise exception 'This booking is closed.'; end if;
  if coalesce(p_path, '') = '' then raise exception 'Upload the receipt first.'; end if;
  if p_method is not null and p_method not in ('gcash','bank_transfer','cash','card','other') then
    raise exception 'Unknown payment method.';
  end if;
  update public.bookings set receipt_path = p_path, payment_method = coalesce(p_method, payment_method) where id = b.id;
  perform public.post_booking_note(b.guest_id, b.id, format('Sent a payment receipt for %s.', b.ref));
end $$;

-- A review after the stay. It shows on the site once the host publishes it.
create or replace function public.guest_save_review(p_booking uuid, p_rating int, p_body text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and guest_id = public.current_guest_id();
  if not found then raise exception 'Booking not found.'; end if;
  if not (b.status = 'checked_out' or (b.status in ('confirmed','checked_in') and b.check_out <= (now() at time zone 'Asia/Manila')::date)) then
    raise exception 'You can leave a review after your stay.';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Pick a rating from 1 to 5 stars.'; end if;
  if length(trim(coalesce(p_body, ''))) < 10 then raise exception 'Tell us a little more (at least a sentence).'; end if;
  insert into public.reviews (booking_id, guest_id, rating, body)
  values (b.id, b.guest_id, p_rating, trim(p_body))
  on conflict (booking_id) do update set rating = excluded.rating, body = excluded.body, status = 'pending'
  where reviews.status <> 'published';
end $$;

create or replace function public.published_reviews()
returns table (id uuid, guest_name text, rating int, body text, host_reply text, stayed_on date, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, split_part(g.full_name, ' ', 1) || coalesce(' ' || left(nullif(split_part(g.full_name, ' ', 2), ''), 1) || '.', ''),
         r.rating, r.body, r.host_reply, b.check_in, r.created_at
  from public.reviews r
  join public.guests g on g.id = r.guest_id
  join public.bookings b on b.id = r.booking_id
  where r.status = 'published'
  order by r.created_at desc;
$$;

grant execute on function public.current_guest_id() to authenticated;
grant execute on function public.guest_save_profile(text, text) to authenticated;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.my_bookings() to authenticated;
grant execute on function public.my_payments(uuid) to authenticated;
grant execute on function public.guest_send_message(text, text, date, date, int) to authenticated;
grant execute on function public.guest_mark_seen() to authenticated;
grant execute on function public.guest_cancel_booking(uuid) to authenticated;
grant execute on function public.guest_attach_receipt(uuid, text, text) to authenticated;
grant execute on function public.guest_save_review(uuid, int, text) to authenticated;
grant execute on function public.published_reviews() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Make the owner the admin. Replace the email, then run this line.
-- She also needs a login: Authentication → Users → Add user (same email).
-- ─────────────────────────────────────────────────────────────
-- insert into public.admins (email) values ('owner@example.com') on conflict do nothing;
