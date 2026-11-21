# Vivienda

Booking website and admin for a single resort. Guests book and pay online, keep their trips and chat with the resort from their own account (Airbnb-style, like the Malaya OBS guest site), and the owner runs bookings, messages, the calendar, guests, reviews and finances from one admin.

**Stack:** Vite + React + TypeScript + Tailwind v4, Supabase (database, auth, storage), Vercel (hosting + three serverless functions for email), Resend (email delivery).

## What's in it

**Guest website**
- Home page with rooms, rates, house rules and contact
- Booking page: pick a room and dates (taken nights are crossed out, nightly prices shown), say who's coming (**adults, children and pets**, with the pet fee added), enter details (local or international mobile), pay a downpayment or **in full** by GCash or bank transfer and upload a receipt, or choose "pay later". Guests must accept the agreement before submitting.
- **Minimum stays:** a standard minimum per room, plus longer ones on chosen check-in dates (holidays, long weekends). Too-short check-outs can't be picked, and the database refuses them too.
- Stay page **Share** button (the phone's share sheet, or copy the link) and **Watch the full tour** from a pasted video link.
- **How to pay** (`/how-to-pay`): the steps for GCash and bank transfer, the accounts with tap-to-copy, and when the balance is due.
- Add it to a phone's home screen and it opens like an app. After each deploy, open tabs offer **"A new version is ready — Refresh"**.
- "Find your booking" (`/my-booking`): guests type the email they booked with and get a one-tap sign-in link that opens all their bookings in Trips. Looking up by confirmation code is still there as a fallback, and the links in booking emails still open the booking directly.
- The look follows Malaya's redesign: paper background, condensed caps headings (Galdeano, the free stand-in Malaya used for Barqen), Montserrat body text, and a "Start your search" sheet on phones.

**Guest accounts** (Airbnb-style, scaled to one resort)
- Sign in / create account / forgot password from the header, the phone tab bar, or any "Message host" button. Accounts are optional; booking still works without one.
- **Trips:** upcoming, past and cancelled stays. Each trip shows its status, check-in/out times, payments and balance, the GCash/bank details, directions and house rules. Guests can upload a payment receipt later, withdraw a request that isn't confirmed yet, and leave a star review after their stay. Cards show what's due and by when, with a Pay button. Once a booking is confirmed, the trip shows the **arrival guide**: how to check in, the wifi (tap to copy the password), parking, the house manual and emergency contacts.
- **Messages:** one ongoing conversation with the resort. It opens as a chat panel from the round button on every page, or full-page at `/messages`. Live updates, unread badges, "Seen" receipts, day separators, and Enter to send. "Message host" on the stay page sends the dates the guest picked along with the question. Guests staying right now get a **Report a problem** button. Booking requests, withdrawals and receipts post a note into the thread automatically. Hover a message (or hold it on a phone) to **reply to it**, **react** with an emoji, or copy it; send **photos** too.
- **Profile:** name, mobile, change password, sign out.
- On phones, a floating tab bar (Explore, Trips, Messages, Profile) replaces the header links.
- Existing bookings show up in Trips as soon as the guest confirms an account with the same email.

**Admin** (`/admin`)
- **Inbox:** every guest conversation, Airbnb-host style. Filter by all, unread, starred or archived, and search. Reply with Enter, use **quick replies** with `{guest}`/`{resort}` placeholders, edit or unsend your own messages, reply to a specific message, react, send photos, mark as unread, star, archive. A quick reply can **send itself** when a booking is made or confirmed, with `{ref}` and `{dates}` filled in. The side panel shows the guest's contact details, their bookings and their inquiry dates with live availability, plus a one-click **Book these dates**. "Message guest" in any booking opens their thread. Unread conversations badge the sidebar and the dashboard.
- **Reviews:** guest reviews wait for you. Publish, hide, or post a public reply. Published ones appear on the home and stay pages with stars, beside the Facebook recommendations. **Add a review** by hand from Airbnb, Google or Facebook; it shows with where it came from.
- **Dashboard:** alerts for unread messages, requests to confirm and today's check-ins/outs; tiles for this month's income, occupancy, guests in house and unpaid balances; a **Performance** card (bookings made this month, occupancy, average nightly rate, RevPAR); every unsettled balance in one list; arrivals for the next 7 days; a 6-month income vs expenses chart
- **Bookings:** tabs (needs action, upcoming, in house, past, cancelled), search and CSV export. The detail panel handles confirm, decline, check-in, check-out and cancel (each can email the guest), recording payments and refunds, viewing the uploaded receipt, private notes, resending any email, and the email history.
- **Add booking:** for Facebook, walk-in and phone bookings. Prices the stay automatically and allows a discount or a custom total.
- **Calendar:** Airbnb-style host calendar, as in Malaya. A month of day tiles shows each night's price, guest-name chips for bookings, closed nights hatched, and special prices tagged. Drag across nights (or click one, then another) to close or reopen them with a reason (including Facebook, Instagram, TikTok and walk-in bookings, and collaborations), set a nightly price or a **minimum stay** or reset them, or add a booking for those dates. Closed nights say who closed them and when. Click a booking to open it.
- **Guests:** history, repeat-guest flag, total paid, notes and CSV export
- **Finance:** income (payments received) vs expenses by month, net profit and margin, spending by category, income by room, unpaid balances, and an expense log with CSV export
- **Rooms & rates:** weekday, Friday–Saturday and extra-guest rates, capacity, pets allowed and the pet fee, minimum stay, video tour link, amenities, photos and visibility
- **Settings**, split into tabs as in Malaya: General (name, contact, location), Booking rules (times, downpayment, house rules, cancellation, agreement), Payments (GCash and bank, with a preview of what guests see), **Arrival guide**, Notifications (every email with its own switch, plus a log of recent sends), Quick replies, and Account & access.
- **Layout:** Malaya's admin shell, with foldable sidebar groups, a breadcrumb trail, sub-tab pills, an account menu with password change, and a bottom nav pill with More on phones.

**Emails** (via Resend): booking received, new-booking alert to the owner, confirmed, declined, cancelled, payment receipt, an automatic arrival reminder N days before check-in (daily cron), the owner's **daily report** at 9 AM (arrivals, departures, in house, requests waiting, yesterday's money; switch it on under Notifications), and new-message alerts both ways. Message alerts go out at most once every 10 minutes per conversation, and never for a reply the guest has already read.

**Safety rules the database enforces**, not just the UI:
- A room can never be double-booked.
- Prices are calculated on the server, so guests can't change them.
- Guests can only read their own booking: with reference + email, or through their own account.
- Signed-in guests only ever see their own trips and their own conversation, and never admin notes. Their writes all go through database functions that check ownership.
- Only emails listed in `admins` can see or change anything else.

## Setup (one time)

### 1. Database
1. Supabase → **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
2. **Authentication → Users → Add user**: create the owner's login (email + password, tick "auto confirm").
3. Back in SQL Editor, make that email the admin:
   ```sql
   insert into public.admins (email) values ('owner@email.com');
   ```
4. **Authentication → Sign In / Providers → Email**: keep **"Allow new users to sign up"** ON (guests create accounts) and keep **"Confirm email"** ON. Confirming the email is what lets an account safely pick up earlier bookings made with that email. Guest accounts can never reach the admin; only emails in `admins` can.
5. **Authentication → Emails → Magic Link**: the default template works. It's the email "Find your booking" sends. Supabase's built-in mailer only sends a few emails an hour; for real traffic, add custom SMTP under Authentication → Emails (Resend gives you SMTP credentials).
6. **Authentication → URL Configuration**: set **Site URL** to the live site (e.g. `https://vivienda.ph`) and add `https://vivienda.ph/**` and `http://localhost:5173/**` to **Redirect URLs**, so the confirm-email and reset-password links come back to the site.

**Updating an existing database:** paste the whole `schema.sql` again and run it. It is safe to re-run, and adds guest accounts, messages, quick replies and reviews without touching existing data. **The November 2026 update needs this:** run `schema.sql` again before deploying the new site, or booking and messaging will fail until you do. It adds the party (children, pets), pay plan, minimum stays, the arrival guide, chat replies, reactions and photos (a private `chat-photos` bucket), automatic quick replies, reviews from other platforms and the daily report switch.

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
To see the site and admin filled in, paste `supabase/seed-demo.sql` into the SQL Editor and run it. It adds sample stays, guests, bookings, payments, expenses, inbox conversations (including an unanswered inquiry and a problem report) and reviews around today's date. Section 0 of that file removes them again. The sample reviews live in `src/lib/site.ts` (`REVIEWS`); replace them with real ones before launch.

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
