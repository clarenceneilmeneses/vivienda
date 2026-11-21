import type { SupabaseClient } from "@supabase/supabase-js";
import { esc, layout, p, type SettingsRow } from "./email.js";

// The owner's morning email, as in Malaya's nightly report: who arrives and
// leaves today, who is in house, what waits on the owner, and yesterday's money.

interface Row {
  ref: string;
  status: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  total: number;
  balance: number;
  guest_name: string;
}

const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function list(rows: Row[], line: (r: Row) => string) {
  if (!rows.length) return p("None.");
  return `<ul style="margin:0 0 12px;padding-left:18px;font-size:14px;line-height:1.7;color:#3d3d3d">${rows
    .map((r) => `<li>${line(r)}</li>`)
    .join("")}</ul>`;
}

function section(title: string, body: string) {
  return `<h2 style="margin:20px 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#7b4821">${esc(title)}</h2>${body}`;
}

export async function sendDailyReport(db: SupabaseClient, s: SettingsRow & { daily_report?: boolean }, site: string, today: string) {
  if (!s.daily_report) return { status: "skipped" as const, message: "Daily report is off." };
  const to = s.admin_notify_email || s.email;
  if (!to) return { status: "skipped" as const, message: "No notification email set." };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: "skipped" as const, message: "RESEND_API_KEY missing." };

  const yesterday = addDays(today, -1);
  const [live, pays, exps, unread] = await Promise.all([
    db
      .from("booking_summary")
      .select("ref, status, check_in, check_out, guests_count, total, balance, guest_name")
      .in("status", ["pending", "confirmed", "checked_in", "checked_out"])
      .gte("check_out", yesterday),
    db.from("payments").select("amount, kind").eq("paid_on", yesterday),
    db.from("expenses").select("amount").eq("spent_on", yesterday),
    db.from("conversations").select("id", { count: "exact", head: true }).eq("admin_unread", true).is("archived_at", null),
  ]);
  const rows = ((live.data ?? []) as Row[]).map((r) => ({ ...r, total: Number(r.total), balance: Number(r.balance) }));

  const arriving = rows.filter((r) => r.check_in === today && ["confirmed", "pending"].includes(r.status));
  const leaving = rows.filter((r) => r.check_out === today && ["checked_in", "confirmed"].includes(r.status));
  const inHouse = rows.filter((r) => r.status === "checked_in");
  const pending = rows.filter((r) => r.status === "pending");
  const soon = rows.filter((r) => r.check_in > today && r.check_in <= addDays(today, 7) && r.status === "confirmed");
  const unpaid = rows.filter((r) => r.balance > 0.009 && r.status !== "pending");
  const income = (pays.data ?? []).reduce((t, x) => t + (x.kind === "refund" ? -1 : 1) * Number(x.amount), 0);
  const spent = (exps.data ?? []).reduce((t, x) => t + Number(x.amount), 0);

  const who = (r: Row) => `<strong>${esc(r.guest_name)}</strong> · ${r.guests_count} pax · ${esc(r.ref)}`;
  const body = [
    p(
      `Good morning! Today: <strong>${arriving.length}</strong> arriving, <strong>${leaving.length}</strong> leaving, ` +
        `<strong>${inHouse.length}</strong> in house.` +
        (pending.length ? ` <strong>${pending.length}</strong> request${pending.length === 1 ? "" : "s"} waiting for you.` : "") +
        (unread.count ? ` <strong>${unread.count}</strong> unread conversation${unread.count === 1 ? "" : "s"}.` : ""),
    ),
    section("Arriving today", list(arriving, (r) => `${who(r)}${r.balance > 0.009 ? ` · <span style="color:#b4532a">${peso(r.balance)} to collect</span>` : ""}`)),
    section("Leaving today", list(leaving, who)),
    pending.length ? section("Waiting for you to confirm", list(pending, (r) => `${who(r)} · ${r.check_in} → ${r.check_out}`)) : "",
    section("Next 7 days", list(soon, (r) => `${r.check_in} · ${who(r)}`)),
    section(
      "Yesterday's money",
      p(`Received ${peso(income)} · spent ${peso(spent)} · net <strong>${peso(income - spent)}</strong>`),
    ),
    unpaid.length
      ? section("Unsettled balances", p(`${peso(unpaid.reduce((t, r) => t + r.balance, 0))} across ${unpaid.length} booking${unpaid.length === 1 ? "" : "s"}.`))
      : "",
  ].join("");

  const html = layout(s, `Your day at ${s.resort_name}`, body, { href: `${site}/admin`, label: "Open the admin" });
  const from = process.env.EMAIL_FROM || `${s.resort_name} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `${s.resort_name} today: ${arriving.length} in, ${leaving.length} out`, html }),
  });
  const status = res.ok ? ("sent" as const) : ("failed" as const);
  await db.from("email_log").insert({
    booking_id: null,
    type: "daily_report",
    to_email: to,
    status,
    error: res.ok ? null : (await res.text()).slice(0, 500),
  });
  return { status };
}
