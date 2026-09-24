import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared by the Vercel functions. Files under api/_lib are not deployed as endpoints.

export const EMAIL_TYPES = [
  "booking_received",
  "new_booking_admin",
  "booking_confirmed",
  "booking_declined",
  "booking_cancelled",
  "payment_received",
  "reminder",
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export interface BookingRow {
  id: string;
  ref: string;
  status: string;
  source: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests_count: number;
  total: number;
  paid: number;
  balance: number;
  discount: number;
  payment_method: string | null;
  receipt_path: string | null;
  special_requests: string | null;
  created_at: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  unit_name: string;
}

export interface SettingsRow {
  resort_name: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  facebook_url: string;
  check_in_time: string;
  check_out_time: string;
  downpayment_percent: number;
  gcash_name: string;
  gcash_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  payment_instructions: string;
  house_rules: string;
  cancellation_policy: string;
  send_emails: boolean;
  admin_notify_email: string;
  reminder_days_before: number;
}

const PROJECT_URL = "https://auksdkawdqufxmjwptwu.supabase.co";

export function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || PROJECT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in Vercel.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function loadBooking(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("booking_summary").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    total: Number(data.total),
    paid: Number(data.paid),
    balance: Number(data.balance),
    discount: Number(data.discount),
  } as BookingRow;
}

export async function loadSettings(db: SupabaseClient) {
  const { data, error } = await db.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as SettingsRow;
}

// ───────────────────────── formatting ─────────────────────────

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function peso(n: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
}

function day(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function time(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const METHOD: Record<string, string> = {
  gcash: "GCash",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

// ───────────────────────── templates ─────────────────────────

interface Built {
  to: string;
  subject: string;
  html: string;
}

function layout(s: SettingsRow, heading: string, body: string, cta?: { href: string; label: string }) {
  const contact = [s.phone, s.email].filter(Boolean).map(esc).join(" · ");
  return `<!doctype html><html><body style="margin:0;background:#f2eee7;font-family:Karla,Segoe UI,Arial,sans-serif;color:#1b1b1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2eee7;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#251911;padding:22px 28px;color:#e9e6d6;font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:4px;text-transform:uppercase">${esc(s.resort_name)}<div style="margin-top:4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#c19c7f">${esc(s.tagline || "")}</div></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#7b4821">${esc(heading)}</h1>
${body}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#7b4821;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;background:#fbfaf8;color:#5b5b5b;font-size:12px;line-height:1.6">
${esc(s.resort_name)}${s.address ? ` · ${esc(s.address)}` : ""}<br>${contact}
${s.facebook_url ? `<br><a href="${esc(s.facebook_url)}" style="color:#7b4821">Message us on Facebook</a>` : ""}
</td></tr>
</table></td></tr></table></body></html>`;
}

function p(text: string) {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d3d3d">${text}</p>`;
}

function details(b: BookingRow, s: SettingsRow, withMoney = true) {
  const rows: [string, string][] = [
    ["Reference", `<strong style="font-family:monospace;letter-spacing:1px">${esc(b.ref)}</strong>`],
    ["Room", esc(b.unit_name)],
    ["Check-in", `${day(b.check_in)}, from ${time(s.check_in_time)}`],
    ["Check-out", `${day(b.check_out)}, by ${time(s.check_out_time)}`],
    ["Guests", String(b.guests_count)],
  ];
  if (withMoney) {
    rows.push(["Total", peso(b.total)]);
    rows.push(["Paid", peso(b.paid)]);
    rows.push(["Balance", `<strong>${peso(b.balance)}</strong>`]);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e9e7e2;border-radius:12px;font-size:14px">
${rows
  .map(
    ([k, v], i) =>
      `<tr><td style="padding:10px 14px;color:#5b5b5b;${i ? "border-top:1px solid #e9e7e2;" : ""}width:40%">${k}</td><td style="padding:10px 14px;${i ? "border-top:1px solid #e9e7e2;" : ""}">${v}</td></tr>`,
  )
  .join("")}
</table>`;
}

function payInfo(b: BookingRow, s: SettingsRow) {
  const lines: string[] = [];
  const down = Math.ceil((b.total * (s.downpayment_percent || 0)) / 100);
  if (s.downpayment_percent > 0 && b.paid < down) {
    lines.push(`To confirm, please send a downpayment of <strong>${peso(down - b.paid)}</strong>.`);
  }
  const methods: string[] = [];
  if (s.gcash_number) methods.push(`<strong>GCash</strong>: ${esc(s.gcash_number)}${s.gcash_name ? ` (${esc(s.gcash_name)})` : ""}`);
  if (s.bank_account_number)
    methods.push(
      `<strong>${esc(s.bank_name || "Bank")}</strong>: ${esc(s.bank_account_number)}${s.bank_account_name ? ` (${esc(s.bank_account_name)})` : ""}`,
    );
  if (!lines.length || !methods.length) return "";
  return `<div style="margin:16px 0;padding:14px 16px;background:#f8f1ea;border-radius:12px;font-size:14px;line-height:1.7;color:#3d3d3d">
${lines.join("<br>")}<br>${methods.join("<br>")}
${s.payment_instructions ? `<br><span style="color:#5b5b5b">${esc(s.payment_instructions)}</span>` : ""}
<br><span style="color:#5b5b5b">Reply to this email with your receipt if you haven't uploaded it yet.</span></div>`;
}

export function buildEmail(type: EmailType, b: BookingRow, s: SettingsRow, siteUrl: string): Built | null {
  const first = esc(b.guest_name.split(" ")[0]);
  const link = b.guest_email
    ? { href: `${siteUrl}/my-booking?ref=${encodeURIComponent(b.ref)}&email=${encodeURIComponent(b.guest_email)}`, label: "View my booking" }
    : undefined;
  const guestTo = b.guest_email ?? "";

  switch (type) {
    case "booking_received":
      return {
        to: guestTo,
        subject: `We received your booking request · ${b.ref}`,
        html: layout(
          s,
          `Thanks, ${first}! We got your request.`,
          p(
            b.receipt_path
              ? "We're checking your payment now and will email you as soon as your stay is confirmed."
              : "Your dates are on hold while we review your request. We'll confirm once we receive your downpayment.",
          ) +
            details(b, s) +
            (b.receipt_path ? "" : payInfo(b, s)),
          link,
        ),
      };
    case "new_booking_admin":
      return {
        to: s.admin_notify_email || s.email,
        subject: `New booking request: ${b.guest_name} · ${b.check_in}`,
        html: layout(
          s,
          "New booking request",
          p(
            `<strong>${esc(b.guest_name)}</strong> booked <strong>${esc(b.unit_name)}</strong> online.` +
              `<br>${esc(b.guest_email ?? "")}${b.guest_phone ? ` · ${esc(b.guest_phone)}` : ""}`,
          ) +
            details(b, s) +
            p(
              `Payment: ${b.payment_method ? METHOD[b.payment_method] ?? b.payment_method : "Pay later"}` +
                (b.receipt_path ? " · <strong>receipt uploaded</strong>" : " · no receipt yet"),
            ) +
            (b.special_requests ? p(`Requests: ${esc(b.special_requests)}`) : ""),
          { href: `${siteUrl}/admin/bookings?id=${b.id}`, label: "Review booking" },
        ),
      };
    case "booking_confirmed":
      return {
        to: guestTo,
        subject: `Your stay is confirmed · ${b.ref}`,
        html: layout(
          s,
          `You're booked, ${first}!`,
          p(`Your stay at ${esc(s.resort_name)} is confirmed. We can't wait to host you.`) +
            details(b, s) +
            (b.balance > 0 ? p(`The remaining balance of <strong>${peso(b.balance)}</strong> is payable on or before check-in.`) : "") +
            (s.house_rules
              ? `<p style="margin:16px 0 6px;font-size:13px;font-weight:600">House rules</p><p style="margin:0;font-size:13px;line-height:1.6;color:#5b5b5b;white-space:pre-line">${esc(s.house_rules)}</p>`
              : ""),
          link,
        ),
      };
    case "booking_declined":
      return {
        to: guestTo,
        subject: `About your booking request · ${b.ref}`,
        html: layout(
          s,
          `Sorry, ${first}`,
          p(
            "We weren't able to accept your booking request for these dates. If you already sent a payment, we'll get in touch about your refund.",
          ) +
            details(b, s, false) +
            p("We'd love to host you another time — reply to this email or message us to find other dates."),
        ),
      };
    case "booking_cancelled":
      return {
        to: guestTo,
        subject: `Booking cancelled · ${b.ref}`,
        html: layout(
          s,
          "Your booking has been cancelled",
          p(`Hi ${first}, this confirms that the booking below is cancelled.`) +
            details(b, s, false) +
            (s.cancellation_policy
              ? p(`<span style="font-size:13px">${esc(s.cancellation_policy)}</span>`)
              : "") +
            p("If you think this is a mistake, just reply to this email."),
        ),
      };
    case "payment_received":
      return {
        to: guestTo,
        subject: `Payment received · ${b.ref}`,
        html: layout(
          s,
          `Thank you, ${first}!`,
          p("We've received your payment. Here's your updated booking summary.") +
            details(b, s) +
            (b.balance <= 0 ? p("<strong>You're fully paid.</strong>") : ""),
          link,
        ),
      };
    case "reminder":
      return {
        to: guestTo,
        subject: `See you soon at ${s.resort_name}!`,
        html: layout(
          s,
          `Your stay is coming up, ${first}`,
          p(`Just a friendly reminder about your upcoming stay. Check-in starts at ${time(s.check_in_time)}.`) +
            details(b, s) +
            (b.balance > 0 ? p(`Balance due on arrival: <strong>${peso(b.balance)}</strong>.`) : "") +
            (s.address ? p(`Address: ${esc(s.address)}`) : ""),
          link,
        ),
      };
  }
}

/** Sends one email and records it in email_log. Never throws. */
export async function deliver(
  db: SupabaseClient,
  type: EmailType,
  b: BookingRow,
  s: SettingsRow,
  siteUrl: string,
): Promise<{ status: "sent" | "skipped" | "failed"; message?: string }> {
  const log = async (status: "sent" | "skipped" | "failed", to: string, error?: string) => {
    await db.from("email_log").insert({ booking_id: b.id, type, to_email: to || "—", status, error: error ?? null });
  };

  const email = buildEmail(type, b, s, siteUrl);
  if (!email || !email.to) {
    const msg = type === "new_booking_admin" ? "No notification email set in Settings." : "Guest has no email.";
    await log("skipped", "", msg);
    return { status: "skipped", message: msg };
  }
  if (type !== "new_booking_admin" && !s.send_emails) {
    const msg = "Guest emails are turned off in Settings.";
    await log("skipped", email.to, msg);
    return { status: "skipped", message: msg };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const msg = "Email isn't set up yet (RESEND_API_KEY missing).";
    await log("skipped", email.to, msg);
    return { status: "skipped", message: msg };
  }

  const from = process.env.EMAIL_FROM || `${s.resort_name} <onboarding@resend.dev>`;
  const replyTo = type === "new_booking_admin" ? b.guest_email : s.email || s.admin_notify_email;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      await log("failed", email.to, text.slice(0, 500));
      return { status: "failed", message: `Email provider error (${res.status}).` };
    }
    await log("sent", email.to);
    return { status: "sent" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log("failed", email.to, msg);
    return { status: "failed", message: "Couldn't reach the email provider." };
  }
}

export function siteUrlFrom(request: Request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

/** Today's date in the Philippines as YYYY-MM-DD. */
export function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}
