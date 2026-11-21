-- ─────────────────────────────────────────────────────────────
-- DEMO DATA for Vivienda. Paste into Supabase → SQL Editor → Run.
--
-- Adds the resort as one listing (booked whole), 12 sample guests, ~18 bookings around today
-- (past, in house, arriving, upcoming, requests, cancelled), their payments,
-- six months of expenses, a holiday rate and a maintenance block.
-- Dates are relative to the day you run it, so the dashboard looks alive.
--
-- Every sample guest uses an @example.com email, which is how the cleanup
-- at the bottom finds them. Run it again any time; it clears the old demo
-- rows first.
--
-- Section 8 also makes two demo LOGINS (run after schema.sql):
--   Admin  admin@gmail.com / password   opens /admin
--   Guest  user@gmail.com  / password   has trips, a review and a chat
-- These are for a demo database only. Change or delete them before going live.
-- ─────────────────────────────────────────────────────────────

-- 0. Clear a previous demo run. (Their conversations, messages and reviews go with the guests.)
-- The demo guest login keeps its account; only its trips and chat are cleared.
delete from public.payments where booking_id in (
  select b.id from public.bookings b join public.guests g on g.id = b.guest_id where lower(g.email) = 'user@gmail.com');
delete from public.bookings where guest_id in (select id from public.guests where lower(email) = 'user@gmail.com');
do $$ begin
  if to_regclass('public.conversations') is not null then
    delete from public.conversations where guest_id in (select id from public.guests where lower(email) = 'user@gmail.com');
  end if;
end $$;
delete from public.payments where booking_id in (
  select b.id from public.bookings b join public.guests g on g.id = b.guest_id where g.email like '%@example.com');
delete from public.bookings where guest_id in (select id from public.guests where email like '%@example.com');
delete from public.guests where email like '%@example.com';
delete from public.expenses where notes = 'demo';
delete from public.rate_overrides where unit_id in (select id from public.units where slug in ('vivienda','whole-resort','a-house','stilt-room','aframe-villa','garden-loft'));
delete from public.blocked_dates where unit_id in (select id from public.units where slug in ('vivienda','whole-resort','a-house','stilt-room','aframe-villa','garden-loft'));
delete from public.units where slug in ('vivienda','whole-resort','a-house','stilt-room','aframe-villa','garden-loft');

-- 1. The resort. One listing: guests always book the whole place.
-- Rates are placeholders; set the real ones in the admin under Rooms & rates.
insert into public.units (name, slug, description, capacity, max_guests, base_rate, weekend_rate, extra_guest_fee, amenities, photos, sort_order) values
('Vivienda Private Resort', 'vivienda',
 'Looking for a private getaway with your family or tropa? This is it. The whole of Vivienda is yours: the private adult and kids pool, the A-House, the Stilt Room, the garden, and the pavilion with karaoke and billiards. 22 hours, check-in 2:00 PM, check-out 12:00 NN.',
 21, 30, 14999, 17999, 300,
 array['Private pool, adult and kids','Karaoke','Bonfire station','BBQ griller','Refrigerator','2-burner stove','Basic utensils','Dining area with tables and chairs','Badminton, billiards and board games','PLDT WiFi','Smart TV','Free Netflix & YouTube'],
 array['/images/aerial.jpg','/images/pool-waterfall.jpg','/images/aframe-stairs.jpg','/images/bunk-room.jpg','/images/pavilion-pool.jpg','/images/garden-umbrellas.jpg','/images/billiards.jpg','/images/kitchen.jpg','/images/playground.jpg'], 1);

-- 2. A holiday rate and a maintenance block.
insert into public.rate_overrides (unit_id, date, rate)
select id, current_date + d, 19999 from public.units, generate_series(35, 36) d where slug = 'vivienda';
insert into public.blocked_dates (unit_id, date, reason)
select id, current_date + d, 'Maintenance' from public.units, generate_series(40, 42) d where slug = 'vivienda';

-- 3. Guests.
insert into public.guests (full_name, email, phone, notes) values
('Angela Mercado',   'angela.mercado@example.com',  '0917 555 0101', 'Birthday group, asked for extra towels.'),
('Ramon De Leon',    'ramon.deleon@example.com',    '0918 555 0102', ''),
('Trisha Lim',       'trisha.lim@example.com',      '0927 555 0103', 'Repeat guest.'),
('Marco Dizon',      'marco.dizon@example.com',     '0905 555 0104', ''),
('Bea Santos',       'bea.santos@example.com',      '0919 555 0105', ''),
('Paolo Reyes',      'paolo.reyes@example.com',     '0916 555 0106', 'Company outing contact.'),
('Katrina Villanueva','katrina.v@example.com',      '0936 555 0107', ''),
('James Tan',        'james.tan@example.com',       '+65 8555 0108', 'Flying in from Singapore.'),
('Mika Gonzales',    'mika.gonzales@example.com',   '0995 555 0109', ''),
('Leo Aquino',       'leo.aquino@example.com',      '0977 555 0110', ''),
('Carla Bautista',   'carla.bautista@example.com',  '0908 555 0111', ''),
('Nico Fernandez',   'nico.fernandez@example.com',  '0921 555 0112', '');

-- 4. Bookings. Totals come from quote_stay, the same price the site charges.
drop table if exists demo_b;
create temporary table demo_b (email text, slug text, a int, b int, pax int, status text, source text, paid_pct int, pay_method text, req text);
insert into demo_b values
 ('angela.mercado@example.com','vivienda', -80,-79, 20,'checked_out','facebook',100,'gcash','Birthday celebration'),
 ('ramon.deleon@example.com',  'vivienda', -62,-61, 12,'checked_out','website', 100,'bank_transfer',''),
 ('trisha.lim@example.com',    'vivienda', -50,-49,  8,'checked_out','website', 100,'gcash',''),
 ('paolo.reyes@example.com',   'vivienda', -44,-43, 28,'checked_out','phone',   100,'bank_transfer','Company outing, needs sound system'),
 ('marco.dizon@example.com',   'vivienda', -31,-30, 15,'checked_out','website', 100,'gcash',''),
 ('bea.santos@example.com',    'vivienda', -20,-19, 18,'checked_out','facebook',100,'cash',''),
 ('trisha.lim@example.com',    'vivienda', -15,-14, 10,'checked_out','website', 100,'gcash','Anniversary'),
 ('katrina.v@example.com',     'vivienda',  -1,  1, 14,'checked_in', 'website',  50,'gcash',''),
 ('james.tan@example.com',     'vivienda',   1,  2,  9,'confirmed',  'website',  50,'card','Late arrival around 9 PM'),
 ('mika.gonzales@example.com', 'vivienda',   5,  6, 25,'confirmed',  'facebook', 50,'gcash','Debut party'),
 ('marco.dizon@example.com',   'vivienda',   7,  8, 12,'cancelled',  'website',   0,null,''),
 ('leo.aquino@example.com',    'vivienda',   9, 10, 16,'pending',    'website',   0,'gcash',''),
 ('bea.santos@example.com',    'vivienda',  12, 13, 25,'declined',   'website',   0,null,''),
 ('carla.bautista@example.com','vivienda',  14, 15, 10,'pending',    'website',   0,null,''),
 ('paolo.reyes@example.com',   'vivienda',  18, 19, 30,'confirmed',  'phone',   100,'bank_transfer',''),
 ('nico.fernandez@example.com','vivienda',  21, 22, 15,'confirmed',  'website',  50,'bank_transfer',''),
 ('angela.mercado@example.com','vivienda',  30, 31, 20,'confirmed',  'website',  50,'gcash','Repeat guest'),
 ('ramon.deleon@example.com',  'vivienda',  35, 36, 24,'pending',    'facebook',  0,null,'Holiday reunion');

do $$
declare r record; u public.units; gid uuid; bid uuid; q record;
begin
  for r in select * from demo_b loop
    select * into u from public.units where slug = r.slug;
    select id into gid from public.guests where email = r.email;
    select * into q from public.quote_stay(u.id, current_date + r.a, current_date + r.b, r.pax);
    insert into public.bookings (unit_id, guest_id, check_in, check_out, guests_count, status, source,
                                 subtotal, total, payment_method, special_requests, waiver_accepted_at, created_at)
    values (u.id, gid, current_date + r.a, current_date + r.b, r.pax, r.status, r.source,
            q.total, q.total, r.pay_method, r.req, now(), now() + ((least(r.a, 0) - 14) || ' days')::interval)
    returning id into bid;
    if r.paid_pct > 0 then
      insert into public.payments (booking_id, amount, method, paid_on, reference)
      values (bid, round(q.total * least(r.paid_pct, 50) / 100.0), coalesce(r.pay_method, 'gcash'),
              current_date + least(r.a, 0) - 10, 'DEMO-' || upper(substr(md5(bid::text), 1, 6)));
      if r.paid_pct = 100 then
        insert into public.payments (booking_id, amount, method, paid_on, reference, notes)
        values (bid, q.total - round(q.total * 0.5), 'cash', current_date + least(r.a, 0), '', 'Balance on arrival');
      end if;
    end if;
  end loop;
end $$;

drop table if exists demo_b;

-- 5. Six months of running costs.
insert into public.expenses (spent_on, category, description, amount, vendor, notes)
select (date_trunc('month', current_date) - (m || ' months')::interval)::date + d, c, descr, amt, vendor, 'demo'
from generate_series(0, 5) m,
(values
  (4,  'utilities',   'Electricity bill',          9800,  'Batelec'),
  (6,  'utilities',   'Water bill',                1650,  'Alitagtag Water District'),
  (9,  'supplies',    'Pool chemicals & chlorine', 3200,  'AquaCare Batangas'),
  (14, 'salaries',    'Caretaker & cleaning staff',12000, 'Staff'),
  (20, 'supplies',    'Toiletries and snacks',     2400,  'Puregold Lipa'),
  (22, 'cleaning',    'Laundry of linens & towels',1800,  'Wash n Dry Alitagtag'),
  (24, 'marketing',   'Facebook ads',              1500,  'Meta')
) as x(d, c, descr, amt, vendor);
insert into public.expenses (spent_on, category, description, amount, vendor, notes) values
  (current_date - 70, 'maintenance', 'Pool pump repair',        6500, 'AquaCare Batangas', 'demo'),
  (current_date - 25, 'maintenance', 'Garden landscaping',      4200, 'Local gardener',    'demo'),
  (current_date - 8,  'maintenance', 'Aircon cleaning (3 units)',3600, 'CoolTech Lipa',    'demo');

-- 6. OPTIONAL: sample house rules and payment details so checkout shows every option.
-- The GCash and bank numbers are placeholders. Replace them in Settings before going live.
update public.settings set
  house_rules = coalesce(nullif(house_rules, ''), 'No loud music after 10:00 PM.
No smoking inside the rooms.
Children must be supervised at the pool at all times.
Please leave the place as you found it; a cleaning fee applies for excessive mess.'),
  cancellation_policy = coalesce(nullif(cancellation_policy, ''), 'Downpayments are non-refundable but can be moved to another date once, if you tell us at least 7 days before check-in.'),
  gcash_name = coalesce(nullif(gcash_name, ''), 'VIVIENDA SAMPLE'),
  gcash_number = coalesce(nullif(gcash_number, ''), '0900 000 0000'),
  bank_name = coalesce(nullif(bank_name, ''), 'BDO'),
  bank_account_name = coalesce(nullif(bank_account_name, ''), 'Vivienda Sample'),
  bank_account_number = coalesce(nullif(bank_account_number, ''), '0000 0000 0000')
where id = 1;

-- 7. Inbox: a few conversations, so Messages has something in it.
-- Demo guests have no website accounts, so only you see these.
do $$
declare gid uuid; cid uuid; bid uuid;
begin
  if to_regclass('public.conversations') is null then return; end if;

  -- An inquiry about dates, still waiting for a reply.
  select id into gid from public.guests where email = 'nico.fernandez@example.com';
  insert into public.conversations (guest_id, inquiry_check_in, inquiry_check_out, inquiry_guests)
  values (gid, current_date + 45, current_date + 46, 18) returning id into cid;
  insert into public.messages (conversation_id, author, author_name, body, sent_at) values
    (cid, 'guest', 'Nico Fernandez', 'Hi! Is the resort available on those dates? We''re around 18 for a barkada reunion.', now() - interval '3 hours'),
    (cid, 'guest', 'Nico Fernandez', 'Also, can we bring our own sound system?', now() - interval '2 hours 50 minutes');

  -- A guest arriving soon, a back-and-forth that is answered.
  select id into gid from public.guests where email = 'james.tan@example.com';
  select id into bid from public.bookings where guest_id = gid and status = 'confirmed' order by check_in limit 1;
  insert into public.conversations (guest_id) values (gid) returning id into cid;
  insert into public.messages (conversation_id, author, author_name, kind, body, booking_id, sent_at) values
    (cid, 'guest', 'James Tan', 'booking', 'Requested to book for 9 guests.', bid, now() - interval '9 days'),
    (cid, 'host', 'Vivienda', 'message', 'Hi James! Your booking is confirmed. See you soon!', null, now() - interval '8 days'),
    (cid, 'guest', 'James Tan', 'message', 'Thank you! We land in Manila at 5 PM, so we''ll arrive around 9 PM. Is that okay?', null, now() - interval '1 day'),
    (cid, 'host', 'Vivienda', 'message', 'No problem at all. Our caretaker will wait for you at the gate. Safe travels!', null, now() - interval '20 hours');
  update public.conversations set guest_seen_at = now() - interval '19 hours' where id = cid;

  -- A guest in house reporting a problem.
  select id into gid from public.guests where email = 'katrina.v@example.com';
  insert into public.conversations (guest_id, starred) values (gid, true) returning id into cid;
  insert into public.messages (conversation_id, author, author_name, kind, body, sent_at) values
    (cid, 'guest', 'Katrina Villanueva', 'problem', 'The aircon in the A-House loft isn''t cooling. Can someone take a look?', now() - interval '25 minutes');

  -- Reviews from past stays: two published, one waiting for you.
  insert into public.reviews (booking_id, guest_id, rating, body, status, host_reply, host_replied_at, created_at)
  select b.id, b.guest_id, x.rating, x.body, x.status, x.reply, case when x.reply <> '' then now() end, now() - (x.ago || ' days')::interval
  from (values
    ('angela.mercado@example.com', 5, 'Perfect for my daughter''s birthday! The pool was clean, the place was spacious and the caretaker was so helpful the whole time.', 'published', 'Thank you, Angela! Happy birthday again to your daughter.', 70),
    ('trisha.lim@example.com',     5, 'Second time here and it''s still our favorite private resort near Lipa. Super relaxing and very private.', 'published', '', 10),
    ('bea.santos@example.com',     4, 'Nice place and very accommodating owner. The road going in is a bit narrow at night, but worth it.', 'pending', '', 2),
    ('ramon.deleon@example.com',   5, 'Sulit for a big family. Malinis ang pool, ang ganda ng A-frame at gabi, at ang bait ng caretaker. Babalik kami!', 'published', 'Salamat po, Ramon! See you again.', 55),
    ('paolo.reyes@example.com',    5, 'We held our company outing here and everything went smoothly. Plenty of space for 28 people, the pavilion was perfect for our program.', 'published', '', 40),
    ('marco.dizon@example.com',    4, 'Very private and relaxing. Bring your own snacks since the nearest store is a short drive away.', 'published', '', 28)
  ) as x(email, rating, body, status, reply, ago)
  join public.guests g on g.email = x.email
  join lateral (select * from public.bookings where guest_id = g.id and status = 'checked_out' order by check_in desc limit 1) b on true;
end $$;

-- 8. Two demo logins, so you can show both sides.
--   admin@gmail.com / password  is an admin (listed in public.admins).
--   user@gmail.com  / password  is a guest with a past stay and a review,
--                               an upcoming trip half paid, and a chat.
-- Safe to run again: existing accounts get their password reset to "password".
do $$
declare
  acct record;
  uid uuid;
  gid uuid;
  u public.units;
  q record;
  past_id uuid;
  next_id uuid;
  cid uuid;
begin
  for acct in select * from (values
    ('admin@gmail.com', 'Vivienda Admin'),
    ('user@gmail.com',  'Bianca Reyes')
  ) as v(email, name) loop
    select id into uid from auth.users where lower(email) = acct.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', acct.email,
              extensions.crypt('password', extensions.gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('full_name', acct.name), now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
              jsonb_build_object('sub', uid::text, 'email', acct.email, 'email_verified', true),
              'email', now(), now(), now());
    else
      update auth.users
         set encrypted_password = extensions.crypt('password', extensions.gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now())
       where id = uid;
    end if;
  end loop;

  -- The admin.
  insert into public.admins (email) values ('admin@gmail.com') on conflict do nothing;

  -- The guest: their record, linked to the login.
  select id into uid from auth.users where lower(email) = 'user@gmail.com';
  select id into gid from public.guests where lower(email) = 'user@gmail.com';
  if gid is null then
    insert into public.guests (full_name, email, phone, notes, user_id)
    values ('Bianca Reyes', 'user@gmail.com', '0917 555 0199', 'Demo guest account.', uid)
    returning id into gid;
  else
    update public.guests set user_id = uid, full_name = 'Bianca Reyes' where id = gid;
  end if;

  select * into u from public.units where slug = 'vivienda';

  -- A stay last month, paid in full, with a published review.
  select * into q from public.quote_stay(u.id, current_date - 34, current_date - 33, 14);
  insert into public.bookings (unit_id, guest_id, check_in, check_out, guests_count, status, source,
                               subtotal, total, payment_method, special_requests, waiver_accepted_at, created_at)
  values (u.id, gid, current_date - 34, current_date - 33, 14, 'checked_out', 'website',
          q.total, q.total, 'gcash', 'Barkada weekend', now(), now() - interval '50 days')
  returning id into past_id;
  insert into public.payments (booking_id, amount, method, paid_on, reference) values
    (past_id, round(q.total * 0.5), 'gcash', current_date - 45, 'DEMO-BR1'),
    (past_id, q.total - round(q.total * 0.5), 'gcash', current_date - 34, 'DEMO-BR2');
  insert into public.reviews (booking_id, guest_id, rating, body, status, created_at)
  values (past_id, gid, 5, 'Our barkada had the best weekend! The pool at night with the string lights was unreal. Super clean and the caretaker was so kind.', 'published', now() - interval '30 days');

  -- A trip in ten days, confirmed, half paid.
  select * into q from public.quote_stay(u.id, current_date + 10, current_date + 12, 18);
  insert into public.bookings (unit_id, guest_id, check_in, check_out, guests_count, status, source,
                               subtotal, total, payment_method, special_requests, waiver_accepted_at, created_at)
  values (u.id, gid, current_date + 10, current_date + 12, 18, 'confirmed', 'website',
          q.total, q.total, 'gcash', 'Birthday dinner on the first night', now(), now() - interval '6 days')
  returning id into next_id;
  insert into public.payments (booking_id, amount, method, paid_on, reference)
  values (next_id, round(q.total * 0.5), 'gcash', current_date - 6, 'DEMO-BR3');

  -- A short chat about the upcoming trip, answered.
  if to_regclass('public.conversations') is not null then
    insert into public.conversations (guest_id) values (gid) returning id into cid;
    insert into public.messages (conversation_id, author, author_name, kind, body, booking_id, sent_at) values
      (cid, 'guest', 'Bianca Reyes', 'booking', 'Requested to book for 18 guests.', next_id, now() - interval '6 days'),
      (cid, 'host', 'Vivienda', 'message', 'Hi Bianca! Your booking is confirmed. We received your downpayment, salamat!', null, now() - interval '5 days'),
      (cid, 'guest', 'Bianca Reyes', 'message', 'Yay! Can we use the griller for the birthday dinner?', null, now() - interval '1 day'),
      (cid, 'host', 'Vivienda', 'message', 'Of course! The BBQ griller and charcoal area are all yours. Just bring the charcoal.', null, now() - interval '22 hours');
    update public.conversations
       set guest_seen_at = now() - interval '21 hours',
           last_message_at = now() - interval '22 hours',
           last_message_preview = 'Of course! The BBQ griller and charcoal area are all yours.',
           last_author = 'host'
     where id = cid;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- TO REMOVE THE DEMO DATA LATER, run section 0 above on its own.
-- (Section 6 only filled blank settings; edit those in the admin.)
-- ─────────────────────────────────────────────────────────────
