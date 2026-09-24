# Vivienda

Booking website and admin for a single resort. Guests book and pay online, and the owner runs bookings, the calendar, guests and finances from one admin.

**Stack:** Vite + React + TypeScript + Tailwind v4, Supabase (database, auth, storage), Vercel (hosting + two serverless functions for email), Resend (email delivery).

## What's in it

**Guest website**
- Home page with rooms, rates, house rules and contact
- Booking page: pick a room and dates (taken nights are crossed out, nightly prices shown), enter details (local or international mobile), pay by GCash or bank transfer and upload a receipt, or choose "pay later". Guests must accept the agreement before submitting.
- "My booking" page: look up status and balance with reference + email

**Admin** (`/admin`)
- **Dashboard:** alerts for requests to confirm and today's check-ins/outs; tiles for this month's income, occupancy, guests in house and unpaid balances; arrivals for the next 7 days; a 6-month income vs expenses chart
- **Bookings:** tabs (needs action, upcoming, in house, past, cancelled), search and CSV export. The detail panel handles confirm, decline, check-in, check-out and cancel (each can email the guest), recording payments and refunds, viewing the uploaded receipt, private notes, resending any email, and the email history.
- **Add booking:** for Facebook, walk-in and phone bookings. Prices the stay automatically and allows a discount or a custom total.
- **Calendar:** every room by day, with booking bars, per-day prices, blocked dates and occupancy. Click a day to block it, set a special price (one day or a range) or start a booking.
- **Guests:** history, repeat-guest flag, total paid, notes and CSV export
- **Finance:** income (payments received) vs expenses by month, net profit and margin, spending by category, income by room, unpaid balances, and an expense log with CSV export
- **Rooms & rates:** weekday, Friday–Saturday and extra-guest rates, capacity, amenities, photos and visibility
- **Settings:** resort info, check-in/out times, downpayment %, GCash/bank details, email toggles, house rules, cancellation policy and waiver text

**Emails** (via Resend): booking received, new-booking alert to the owner, confirmed, declined, cancelled, payment receipt, and an automatic arrival reminder N days before check-in (daily cron).

**Safety rules the database enforces**, not just the UI:
- A room can never be double-booked.
- Prices are calculated on the server, so guests can't change them.
- Guests can only read their own booking, and only with reference + email.
- Only emails listed in `admins` can see or change anything else.

## Setup (one time)

### 1. Database
1. Supabase → **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
2. **Authentication → Users → Add user**: create the owner's login (email + password, tick "auto confirm").
3. Back in SQL Editor, make that email the admin:
   ```sql
   insert into public.admins (email) values ('owner@email.com');
   ```
4. **Authentication → Sign In / Providers**: turn off **"Allow new users to sign up"**. Only the owner should have an account.

### 2. Vercel
Import the GitHub repo into Vercel (framework preset: Vite). Add these **Environment Variables**:

| Name | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **secret** / service_role key. Server-only, never put it in the code. |
| `RESEND_API_KEY` | From resend.com → API Keys |
| `EMAIL_FROM` | e.g. `Vivienda <bookings@yourdomain.com>` (the domain must be verified in Resend) |
| `CRON_SECRET` | Any long random string. Vercel uses it to call the daily reminder job. |
| `SITE_URL` | *(optional)* e.g. `https://vivienda.ph`, used for links inside emails |

The public Supabase URL and publishable key are already in `.env`. They're safe to ship to browsers, and row-level security protects the data.

Until `RESEND_API_KEY` is set, the site works normally. Emails are skipped and logged as "skipped" on each booking.

### 3. Resend (email)
Create an account at resend.com, add the resort's domain, and add the DNS records it gives you. Without a verified domain, Resend only delivers to your own account email (fine for testing).

### Demo data (optional)
To see the site and admin filled in, paste `supabase/seed-demo.sql` into the SQL Editor and run it. It adds sample stays, guests, bookings, payments and expenses around today's date. Section 0 of that file removes them again. The sample reviews live in `src/lib/site.ts` (`REVIEWS`); replace them with real ones before launch.

### 4. First use
Log in at `/admin` and:
1. Fill in **Settings** (payment details, rules, the email for new-booking alerts).
2. Add rooms under **Rooms & rates**.
3. Add any existing Facebook bookings with **Add booking**.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

The `/api` functions run on Vercel. To exercise emails locally, use `vercel dev`.
