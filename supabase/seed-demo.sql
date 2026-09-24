-- ─────────────────────────────────────────────────────────────
-- DEMO DATA for Vivienda. Paste into Supabase → SQL Editor → Run.
--
-- Adds three sample stays (Whole Resort, A-House, Stilt Room), 12 sample guests, ~18 bookings around today
-- (past, in house, arriving, upcoming, requests, cancelled), their payments,
-- six months of expenses, a holiday rate and a maintenance block.
-- Dates are relative to the day you run it, so the dashboard looks alive.
--
-- Every sample guest uses an @example.com email, which is how the cleanup
-- at the bottom finds them. Run it again any time; it clears the old demo
-- rows first.
-- ─────────────────────────────────────────────────────────────

-- 0. Clear a previous demo run.
delete from public.payments where booking_id in (
  select b.id from public.bookings b join public.guests g on g.id = b.guest_id where g.email like '%@example.com');
delete from public.bookings where guest_id in (select id from public.guests where email like '%@example.com');
delete from public.guests where email like '%@example.com';
delete from public.expenses where notes = 'demo';
delete from public.rate_overrides where unit_id in (select id from public.units where slug in ('whole-resort','a-house','stilt-room','aframe-villa','garden-loft'));
delete from public.blocked_dates where unit_id in (select id from public.units where slug in ('whole-resort','a-house','stilt-room','aframe-villa','garden-loft'));
delete from public.units where slug in ('whole-resort','a-house','stilt-room','aframe-villa','garden-loft');

-- 1. Stays. Photos point at the images shipped with the site.
insert into public.units (name, slug, description, capacity, max_guests, base_rate, weekend_rate, extra_guest_fee, amenities, photos, sort_order) values
('Whole Resort Overnight', 'whole-resort',
 'Looking for a private getaway with your family or tropa? This is it. The whole of Vivienda for your group: the private adult and kids pool, the A-House, the Stilt Room, the garden, and the pavilion with karaoke and billiards. 22 hours, check-in 2:00 PM, check-out 12:00 NN.',
 15, 25, 14999, 17999, 300,
 array['Private pool, adult and kids','A-House and Stilt Room','Karaoke','Bonfire station','BBQ griller','Refrigerator','2-burner stove','Basic utensils','Dining area with tables and chairs','Badminton, billiards and board games','PLDT WiFi','Smart TV','Free Netflix & YouTube'],
 array['/images/aerial.jpg','/images/pool-waterfall.jpg','/images/pavilion-pool.jpg','/images/bunk-room.jpg','/images/garden-umbrellas.jpg','/images/billiards.jpg','/images/event-setup.jpg','/images/kitchen.jpg','/images/playground.jpg'], 1),
('A-House', 'a-house',
 'The glass A-frame by the pool. Sleeps up to 7: 2 double-size beds, 1 queen-size sofa bed, and a single bed upon request. Pool, karaoke and the rest of the amenities included.',
 4, 7, 8999, 10999, 500,
 array['2 double-size beds','1 queen-size sofa bed','Single bed (upon request)','Private pool access','Smart TV','Free Netflix & YouTube','PLDT WiFi','Karaoke'],
 array['/images/pool-overcast.jpg','/images/aframe-stairs.jpg','/images/aframe-loft-bed.jpg','/images/aframe-tv.jpg','/images/aframe-lounge.jpg'], 2),
('Stilt Room', 'stilt-room',
 'The upstairs group room with a balcony over the fields. Sleeps up to 14: 3 double-size double-deck beds and 1 queen sofa bed.',
 8, 14, 9999, 11999, 400,
 array['3 double-size double-deck beds','1 queen sofa bed','Balcony','Air-conditioning','Private pool access','PLDT WiFi'],
 array['/images/bunk-room.jpg','/images/bunk-balcony.jpg','/images/lounge-sign.jpg','/images/garden-wide.jpg','/images/front.jpg'], 3);

-- 2. A holiday rate and a maintenance block.
insert into public.rate_overrides (unit_id, date, rate)
select id, current_date + d, 19999 from public.units, generate_series(35, 36) d where slug = 'whole-resort';
insert into public.blocked_dates (unit_id, date, reason)
select id, current_date + d, 'Maintenance' from public.units, generate_series(40, 42) d where slug = 'stilt-room';

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
 ('angela.mercado@example.com','whole-resort', -80,-79, 20,'checked_out','facebook',100,'gcash','Birthday celebration'),
 ('ramon.deleon@example.com',  'a-house',    -62,-60,  6,'checked_out','website', 100,'bank_transfer',''),
 ('trisha.lim@example.com',    'stilt-room',   -50,-48,  2,'checked_out','website', 100,'gcash',''),
 ('paolo.reyes@example.com',   'whole-resort', -44,-43, 25,'checked_out','phone',   100,'bank_transfer','Company outing, needs sound system'),
 ('marco.dizon@example.com',   'a-house',    -31,-29,  6,'checked_out','website', 100,'gcash',''),
 ('bea.santos@example.com',    'whole-resort', -20,-18, 18,'checked_out','facebook',100,'cash',''),
 ('trisha.lim@example.com',    'stilt-room',   -15,-13,  3,'checked_out','website', 100,'gcash','Anniversary'),
 ('katrina.v@example.com',     'a-house',     -1,  1,  7,'checked_in', 'website',  50,'gcash',''),
 ('james.tan@example.com',     'stilt-room',     0,  2,  2,'confirmed',  'website',  50,'card','Late arrival around 9 PM'),
 ('mika.gonzales@example.com', 'whole-resort',   5,  6, 22,'confirmed',  'facebook', 50,'gcash','Debut party'),
 ('leo.aquino@example.com',    'a-house',      9, 11,  6,'pending',    'website',   0,'gcash',''),
 ('carla.bautista@example.com','stilt-room',    14, 15,  2,'pending',    'website',   0,null,''),
 ('nico.fernandez@example.com','whole-resort',  21, 22, 15,'confirmed',  'website',  50,'bank_transfer',''),
 ('angela.mercado@example.com','a-house',     30, 32,  7,'confirmed',  'website',  50,'gcash','Repeat guest'),
 ('ramon.deleon@example.com',  'whole-resort',  35, 36, 20,'pending',    'facebook',  0,null,'Holiday reunion'),
 ('marco.dizon@example.com',   'stilt-room',     7,  8,  2,'cancelled',  'website',   0,null,''),
 ('bea.santos@example.com',    'whole-resort',  12, 13, 25,'declined',   'website',   0,null,''),
 ('paolo.reyes@example.com',   'a-house',     18, 20,  7,'confirmed',  'phone',   100,'bank_transfer','');

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

-- ─────────────────────────────────────────────────────────────
-- TO REMOVE THE DEMO DATA LATER, run section 0 above on its own.
-- (Section 6 only filled blank settings; edit those in the admin.)
-- ─────────────────────────────────────────────────────────────
