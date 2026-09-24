import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  CalendarCheck,
  CheckCircle2,
  FileImage,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Plus,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { normalizeBooking } from "../../lib/queries";
import { money, plural, prettyDate, stayRange } from "../../lib/format";
import { EMAIL_LABEL, sendBookingEmail, type EmailType } from "../../lib/email";
import {
  METHOD_LABEL,
  SOURCE_LABEL,
  type BookingStatus,
  type BookingSummary,
  type EmailLog,
  type Payment,
} from "../../lib/types";
import { Badge, Button, Modal, Select, Sheet, Spinner, StatusBadge, Textarea } from "../ui";
import { BookingForm } from "./BookingForm";
import { PaymentForm } from "./PaymentForm";

interface Transition {
  to: BookingStatus;
  label: string;
  icon: typeof CheckCircle2;
  email?: EmailType;
  variant: "primary" | "secondary" | "danger";
  confirm?: string;
}

const TRANSITIONS: Partial<Record<BookingStatus, Transition[]>> = {
  pending: [
    { to: "confirmed", label: "Confirm", icon: CheckCircle2, email: "booking_confirmed", variant: "primary" },
    {
      to: "declined",
      label: "Decline",
      icon: XCircle,
      email: "booking_declined",
      variant: "danger",
      confirm: "Decline this request? The dates open up again.",
    },
  ],
  confirmed: [
    { to: "checked_in", label: "Check in", icon: LogIn, variant: "primary" },
    {
      to: "cancelled",
      label: "Cancel booking",
      icon: XCircle,
      email: "booking_cancelled",
      variant: "danger",
      confirm: "Cancel this booking? The dates open up again. Refunds are recorded separately under Payments.",
    },
  ],
  checked_in: [{ to: "checked_out", label: "Check out", icon: LogOut, variant: "primary" }],
};

export function BookingDrawer({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  return (
    <Sheet
      open={Boolean(bookingId)}
      onClose={onClose}
      title={<span className="text-sm font-medium text-ink-muted">Booking</span>}
    >
      {bookingId && <DrawerBody id={bookingId} onClose={onClose} />}
    </Sheet>
  );
}

function DrawerBody({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [pending, setPending] = useState<Transition | null>(null);
  const [emailType, setEmailType] = useState<EmailType>("booking_confirmed");
  const [sending, setSending] = useState(false);

  const { data: b, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async (): Promise<BookingSummary | null> => {
      const { data, error } = await supabase.from("booking_summary").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? normalizeBooking(data) : null;
    },
  });
  const { data: payments } = useQuery({
    queryKey: ["payments", "booking", id],
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase.from("payments").select("*").eq("booking_id", id).order("paid_on");
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) as Payment[];
    },
  });
  const { data: emails } = useQuery({
    queryKey: ["email_log", id],
    queryFn: async (): Promise<EmailLog[]> => {
      const { data, error } = await supabase
        .from("email_log")
        .select("*")
        .eq("booking_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmailLog[];
    },
  });
  const { data: receiptUrl } = useQuery({
    queryKey: ["receipt", b?.receipt_path],
    enabled: Boolean(b?.receipt_path),
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("receipts").createSignedUrl(b!.receipt_path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  if (isLoading) return <Spinner />;
  if (!b) return <p className="p-6 text-sm text-ink-muted">This booking no longer exists.</p>;

  async function applyStatus(t: Transition, sendEmail: boolean) {
    const { error } = await supabase.from("bookings").update({ status: t.to }).eq("id", b!.id);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    await qc.invalidateQueries();
    toast.success(`Marked ${t.label.toLowerCase().replace(" booking", "")}`);
    if (sendEmail && t.email && b!.guest_email) {
      const r = await sendBookingEmail(t.email, b!.id);
      if (r.ok && r.status === "sent") toast.success("Guest emailed");
      else if (!r.ok) toast.error(r.message);
      else if (r.message) toast.message(r.message);
      qc.invalidateQueries({ queryKey: ["email_log", id] });
    }
  }

  async function sendManual() {
    setSending(true);
    const r = await sendBookingEmail(emailType, b!.id);
    setSending(false);
    if (r.ok && r.status === "sent") toast.success("Email sent");
    else if (!r.ok) toast.error(r.message);
    else toast.message(r.message ?? "Email skipped");
    qc.invalidateQueries({ queryKey: ["email_log", id] });
  }

  async function deletePayment(p: Payment) {
    if (!confirm(`Delete this ${money(p.amount)} ${p.kind}?`)) return;
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) return toast.error(errorMessage(error));
    await qc.invalidateQueries();
  }

  async function deleteBooking() {
    if (!confirm(`Delete ${b!.ref} permanently? Its payments are deleted too. This can't be undone.`)) return;
    const { error } = await supabase.from("bookings").delete().eq("id", b!.id);
    if (error) return toast.error(errorMessage(error));
    if (b!.receipt_path) await supabase.storage.from("receipts").remove([b!.receipt_path]);
    await qc.invalidateQueries();
    toast.success("Booking deleted");
    onClose();
  }

  const transitions = TRANSITIONS[b.status] ?? [];

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-xl border border-sand-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wider text-ink-muted">{b.ref}</p>
            <h2 className="font-display mt-1 truncate text-2xl font-semibold">{b.guest_name}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {b.unit_name} · {stayRange(b.check_in, b.check_out)}
            </p>
            <p className="text-sm text-ink-muted">
              {plural(b.nights, "night")} · {plural(b.guests_count, "guest")}
            </p>
          </div>
          <StatusBadge status={b.status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {transitions.map((t) => (
            <Button
              key={t.to}
              size="sm"
              variant={t.variant}
              onClick={() => setPending(t)}
            >
              <t.icon className="size-4" /> {t.label}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-sand-200 bg-white p-5 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Info label="Email">
            {b.guest_email ? (
              <a href={`mailto:${b.guest_email}`} className="inline-flex items-center gap-1 hover:underline">
                <Mail className="size-3.5" /> {b.guest_email}
              </a>
            ) : (
              "—"
            )}
          </Info>
          <Info label="Mobile">
            {b.guest_phone ? (
              <a href={`tel:${b.guest_phone}`} className="inline-flex items-center gap-1 hover:underline">
                <Phone className="size-3.5" /> {b.guest_phone}
              </a>
            ) : (
              "—"
            )}
          </Info>
          <Info label="Booked via">{SOURCE_LABEL[b.source]}</Info>
          <Info label="Booked on">{format(parseISO(b.created_at), "MMM d, yyyy h:mm a")}</Info>
          {b.waiver_accepted_at && (
            <Info label="Agreement">
              <span className="inline-flex items-center gap-1">
                <CalendarCheck className="size-3.5" /> Accepted {format(parseISO(b.waiver_accepted_at), "MMM d")}
              </span>
            </Info>
          )}
          {b.payment_method && <Info label="Paying by">{METHOD_LABEL[b.payment_method]}</Info>}
        </dl>
        {b.special_requests && (
          <div className="mt-4 rounded-lg bg-sand-50 p-3">
            <p className="text-xs font-medium text-ink-muted">Guest requests</p>
            <p className="mt-1 whitespace-pre-line">{b.special_requests}</p>
          </div>
        )}
        <NotesEditor booking={b} />
      </div>

      <div className="rounded-xl border border-sand-200 bg-white">
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
          <h3 className="text-sm font-semibold">Payments</h3>
          <Button size="sm" variant="secondary" onClick={() => setPayOpen(true)}>
            <Plus className="size-4" /> Record
          </Button>
        </div>
        <div className="px-5 py-3">
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Money label="Total" value={b.total} note={b.discount > 0 ? `${money(b.discount)} off` : undefined} />
            <Money label="Paid" value={b.paid} />
            <Money label="Balance" value={b.balance} emphasize={b.balance > 0} />
          </dl>
          {receiptUrl && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center gap-2 rounded-lg border border-sand-200 px-3 py-2 text-sm hover:bg-sand-50"
            >
              <FileImage className="size-4 text-clay-500" />
              Guest uploaded a receipt — view
            </a>
          )}
          {payments && payments.length > 0 && (
            <ul className="mt-3 divide-y divide-sand-200 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className={p.kind === "refund" ? "text-red-700" : ""}>
                      {p.kind === "refund" ? "−" : ""}
                      {money(p.amount)} <span className="text-ink-muted">· {METHOD_LABEL[p.method]}</span>
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {prettyDate(p.paid_on)}
                      {p.reference && ` · Ref ${p.reference}`}
                      {p.notes && ` · ${p.notes}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deletePayment(p)}
                    className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-700"
                    aria-label="Delete payment"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-sand-200 bg-white">
        <div className="border-b border-sand-200 px-5 py-3">
          <h3 className="text-sm font-semibold">Emails</h3>
        </div>
        <div className="space-y-3 px-5 py-3">
          {b.guest_email ? (
            <div className="flex gap-2">
              <Select value={emailType} onChange={(e) => setEmailType(e.target.value as EmailType)} className="h-9">
                {(Object.keys(EMAIL_LABEL) as EmailType[])
                  .filter((t) => t !== "new_booking_admin")
                  .map((t) => (
                    <option key={t} value={t}>
                      {EMAIL_LABEL[t]}
                    </option>
                  ))}
              </Select>
              <Button size="sm" variant="secondary" className="h-9" onClick={sendManual} loading={sending}>
                <Send className="size-4" /> Send
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No email on file for this guest.</p>
          )}
          {emails && emails.length > 0 && (
            <ul className="space-y-1.5 text-xs">
              {emails.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {EMAIL_LABEL[e.type as EmailType] ?? e.type} → {e.to_email}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-ink-muted">
                    <Badge
                      className={
                        e.status === "sent"
                          ? "bg-forest-50 text-forest-700"
                          : e.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : ""
                      }
                    >
                      {e.status}
                    </Badge>
                    {format(parseISO(e.created_at), "MMM d, h:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {["cancelled", "declined"].includes(b.status) && (
        <div className="pt-2 text-center">
          <Button variant="danger" size="sm" onClick={deleteBooking}>
            <Trash2 className="size-4" /> Delete booking
          </Button>
        </div>
      )}

      <BookingForm open={editOpen} onClose={() => setEditOpen(false)} booking={b} />
      <PaymentForm open={payOpen} onClose={() => setPayOpen(false)} booking={b} />
      <TransitionModal
        transition={pending}
        booking={b}
        onClose={() => setPending(null)}
        onConfirm={async (email) => {
          const t = pending!;
          setPending(null);
          await applyStatus(t, email);
        }}
      />
    </div>
  );
}

function TransitionModal({
  transition,
  booking,
  onClose,
  onConfirm,
}: {
  transition: Transition | null;
  booking: BookingSummary;
  onClose: () => void;
  onConfirm: (sendEmail: boolean) => Promise<void>;
}) {
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => setEmail(true), [transition]);
  if (!transition) return null;
  const canEmail = Boolean(transition.email && booking.guest_email);
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`${transition.label}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={transition.variant === "danger" ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm(canEmail && email);
              setBusy(false);
            }}
          >
            {transition.label}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-ink-soft">
          {transition.confirm ??
            `${booking.guest_name} · ${booking.unit_name} · ${stayRange(booking.check_in, booking.check_out)}`}
        </p>
        {transition.to === "confirmed" && booking.paid <= 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            No payment is recorded yet. You can record the downpayment after confirming.
          </p>
        )}
        {canEmail && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={email}
              onChange={(e) => setEmail(e.target.checked)}
              className="size-4 accent-forest-700"
            />
            Email {booking.guest_email}
          </label>
        )}
      </div>
    </Modal>
  );
}

function NotesEditor({ booking }: { booking: BookingSummary }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(booking.admin_notes ?? "");
  useEffect(() => setValue(booking.admin_notes ?? ""), [booking.admin_notes]);
  return (
    <div className="mt-4">
      <label className="text-xs font-medium text-ink-muted" htmlFor="admin-notes">
        Private notes
      </label>
      <Textarea
        id="admin-notes"
        rows={2}
        className="mt-1"
        value={value}
        placeholder="Only you see these"
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          if (value === (booking.admin_notes ?? "")) return;
          const { error } = await supabase.from("bookings").update({ admin_notes: value }).eq("id", booking.id);
          if (error) toast.error(errorMessage(error));
          else {
            toast.success("Notes saved");
            qc.invalidateQueries({ queryKey: ["booking", booking.id] });
          }
        }}
      />
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate">{children}</dd>
    </div>
  );
}

function Money({ label, value, note, emphasize }: { label: string; value: number; note?: string; emphasize?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={emphasize ? "font-semibold text-clay-600" : "font-semibold"}>{money(value)}</dd>
      {note && <dd className="text-xs text-ink-muted">{note}</dd>}
    </div>
  );
}
