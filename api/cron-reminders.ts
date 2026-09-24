import { adminClient, deliver, json, loadBooking, loadSettings, manilaToday, siteUrlFrom } from "./_lib/email.js";

// Runs daily (see vercel.json). Emails confirmed guests N days before check-in.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ message: "Unauthorized" }, 401);
  }

  const db = adminClient();
  const settings = await loadSettings(db);
  const days = settings.reminder_days_before;
  if (!days || !settings.send_emails) return json({ sent: 0, note: "Reminders are off" });

  const target = new Date(`${manilaToday()}T00:00:00Z`);
  target.setUTCDate(target.getUTCDate() + days);
  const targetIso = target.toISOString().slice(0, 10);

  const { data, error } = await db
    .from("bookings")
    .select("id")
    .eq("status", "confirmed")
    .eq("check_in", targetIso)
    .is("reminder_sent_at", null);
  if (error) return json({ message: error.message }, 500);

  const site = siteUrlFrom(request);
  let sent = 0;
  for (const { id } of data ?? []) {
    const booking = await loadBooking(db, id);
    if (!booking) continue;
    const r = await deliver(db, "reminder", booking, settings, site);
    if (r.status === "sent") {
      sent++;
      await db.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", id);
    }
  }
  return json({ sent, checked: data?.length ?? 0, date: targetIso });
}
