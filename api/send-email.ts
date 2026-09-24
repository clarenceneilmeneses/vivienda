import { adminClient, deliver, EMAIL_TYPES, json, loadBooking, loadSettings, siteUrlFrom, type EmailType } from "./_lib/email.js";

// Guests may only trigger the two "new booking" emails, only for a booking
// made in the last 30 minutes, and only once. Everything else needs the admin.
const PUBLIC_TYPES: EmailType[] = ["booking_received", "new_booking_admin"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: { type?: string; bookingId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ message: "Bad request" }, 400);
  }
  const type = body.type as EmailType;
  const bookingId = String(body.bookingId ?? "");
  if (!EMAIL_TYPES.includes(type) || !UUID.test(bookingId)) return json({ message: "Bad request" }, 400);

  let db;
  try {
    db = adminClient();
  } catch (err) {
    return json({ ok: false, status: "skipped", message: (err as Error).message }, 200);
  }

  const booking = await loadBooking(db, bookingId);
  if (!booking) return json({ message: "Booking not found" }, 404);

  const isAdmin = await callerIsAdmin(db, request);
  if (!isAdmin) {
    if (!PUBLIC_TYPES.includes(type)) return json({ message: "Not allowed" }, 403);
    const ageMs = Date.now() - new Date(booking.created_at).getTime();
    if (ageMs > 30 * 60_000) return json({ message: "Not allowed" }, 403);
    const { count } = await db
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", booking.id)
      .eq("type", type);
    if ((count ?? 0) > 0) return json({ ok: true, status: "skipped", message: "Already sent" });
  }

  const settings = await loadSettings(db);
  const result = await deliver(db, type, booking, settings, siteUrlFrom(request));
  return json({ ok: result.status !== "failed", ...result }, result.status === "failed" ? 502 : 200);
}

async function callerIsAdmin(db: ReturnType<typeof adminClient>, request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email) return false;
  const { data: row } = await db.from("admins").select("email").ilike("email", data.user.email).maybeSingle();
  return Boolean(row);
}
