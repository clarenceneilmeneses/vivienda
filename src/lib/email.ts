import { supabase } from "./supabase";

export type EmailType =
  | "booking_received"
  | "new_booking_admin"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_cancelled"
  | "payment_received"
  | "reminder";

export const EMAIL_LABEL: Record<EmailType, string> = {
  booking_received: "Booking received",
  new_booking_admin: "New booking alert (to you)",
  booking_confirmed: "Booking confirmed",
  booking_declined: "Booking declined",
  booking_cancelled: "Booking cancelled",
  payment_received: "Payment receipt",
  reminder: "Arrival reminder",
};

export interface EmailResult {
  ok: boolean;
  status?: "sent" | "skipped" | "failed";
  message?: string;
}

/**
 * Asks the server to send one of the booking emails. The server builds the
 * email from the booking itself, so the browser never chooses what gets sent.
 */
export async function sendBookingEmail(type: EmailType, bookingId: string): Promise<EmailResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ type, bookingId }),
    });
    const body = (await res.json().catch(() => ({}))) as EmailResult;
    if (!res.ok) return { ok: false, status: "failed", message: body.message ?? `Email failed (${res.status})` };
    return { ...body, ok: true };
  } catch {
    return { ok: false, status: "failed", message: "Email service unreachable." };
  }
}
