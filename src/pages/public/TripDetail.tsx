import { useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Receipt,
  Star,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { useSettings } from "../../lib/queries";
import { useAttachReceipt, useCancelTrip, useMyTrips, useSaveReview, useTripPayments, type Trip } from "../../lib/guest";
import { isoDate, money, plural, prettyDate, prettyTime } from "../../lib/format";
import { errorMessage } from "../../lib/supabase";
import { SITE } from "../../lib/site";
import { cn } from "../../lib/utils";
import { METHOD_LABEL, type BookingStatus, type PaymentMethod } from "../../lib/types";
import { Button, Modal, Spinner, StatusBadge, Textarea } from "../../components/ui";
import { GuestOnly, tripPhoto } from "./Trips";

const NEXT: Record<BookingStatus, { title: string; body: string }> = {
  pending: {
    title: "We're reviewing your request",
    body: "We check your payment and confirm within 24 hours. You'll get an email and a message here.",
  },
  confirmed: { title: "You're all set", body: "Your dates are reserved. We'll send a reminder before check-in." },
  checked_in: { title: "Enjoy your stay", body: "Need anything? Message us and we'll come right over." },
  checked_out: { title: "Thanks for staying with us", body: "We hope to host you again soon." },
  cancelled: { title: "This booking was cancelled", body: "The dates have been released." },
  declined: { title: "We couldn't accept this request", body: "Message us and we'll help you find other dates." },
};

export default function TripDetail() {
  return (
    <GuestOnly title="Trip details">
      <TripBody />
    </GuestOnly>
  );
}

function TripBody() {
  const { ref } = useParams();
  const { data: trips, isLoading } = useMyTrips();
  const { data: settings } = useSettings();
  const navigate = useNavigate();
  const cancel = useCancelTrip();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  const t = trips?.find((x) => x.ref.toUpperCase() === (ref ?? "").toUpperCase());
  if (!t) return <Navigate to="/trips" replace />;

  const phone = settings?.phone || SITE.phone;
  const mapUrl = settings?.map_url || SITE.mapUrl;
  const closed = ["cancelled", "declined"].includes(t.status);
  const live = ["pending", "confirmed", "checked_in"].includes(t.status);
  const next = NEXT[t.status];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-8 sm:pt-10">
      <Link to="/trips" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand-700">
        <ArrowLeft className="size-4" /> All trips
      </Link>

      <div className="relative mt-4 h-52 overflow-hidden rounded-3xl sm:h-72">
        <img src={tripPhoto(t)} alt="" className={cn("size-full object-cover", closed && "grayscale")} />
        <div className="absolute inset-0 bg-linear-to-t from-espresso/80 via-espresso/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-5 text-white sm:p-7">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase opacity-80">{t.ref}</p>
            <h1 className="site-display mt-1 text-2xl sm:text-4xl">{t.unit_name}</h1>
          </div>
          <StatusBadge status={t.status} className="bg-white" />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <div
            className={cn(
              "flex items-start gap-3 rounded-2xl p-4",
              closed ? "bg-red-50 text-red-900" : t.status === "pending" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900",
            )}
          >
            {closed ? <XCircle className="mt-0.5 size-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0" />}
            <div>
              <p className="font-semibold">{next.title}</p>
              <p className="mt-0.5 text-sm opacity-90">{next.body}</p>
            </div>
          </div>

          <Section title="Reservation">
            <div className="grid grid-cols-2 divide-x divide-sand-200 rounded-2xl border border-sand-200">
              <div className="p-4">
                <p className="text-xs text-ink-muted">Check-in</p>
                <p className="mt-1 font-semibold text-ink">{prettyDate(t.check_in, "EEE, MMM d")}</p>
                <p className="text-sm text-ink-soft">{prettyTime(settings?.check_in_time ?? "14:00")}</p>
              </div>
              <div className="p-4">
                <p className="text-xs text-ink-muted">Checkout</p>
                <p className="mt-1 font-semibold text-ink">{prettyDate(t.check_out, "EEE, MMM d")}</p>
                <p className="text-sm text-ink-soft">{prettyTime(settings?.check_out_time ?? "12:00")}</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Row icon={<Users />} label="Guests" value={plural(t.guests_count, "guest")} />
              <Row icon={<CalendarDays />} label="Length" value={plural(t.nights, "night")} />
              <Row
                icon={<Copy />}
                label="Confirmation code"
                value={
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(t.ref).then(() => toast.success("Copied"))}
                    className="cursor-pointer font-mono font-semibold underline decoration-dotted underline-offset-4"
                  >
                    {t.ref}
                  </button>
                }
              />
              <Row icon={<Clock />} label="Booked on" value={prettyDate(t.created_at.slice(0, 10))} />
            </dl>
            {t.special_requests && (
              <p className="mt-4 rounded-xl bg-sand-100 px-4 py-3 text-sm text-ink-soft">
                <span className="font-medium text-ink">Your note: </span>
                {t.special_requests}
              </p>
            )}
          </Section>

          {live && (
            <Section title="Getting there">
              <p className="flex items-start gap-2 text-sm text-ink-soft">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" /> {settings?.address || SITE.address}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 px-4 text-sm font-medium text-ink hover:bg-sand-100"
                >
                  <Navigation className="size-4" /> Get directions
                </a>
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 px-4 text-sm font-medium text-ink hover:bg-sand-100"
                >
                  <Phone className="size-4" /> Call {phone}
                </a>
              </div>
            </Section>
          )}

          {(settings?.house_rules || settings?.cancellation_policy) && (
            <Section title="Things to know">
              {settings?.house_rules && <Collapsible title="House rules" body={settings.house_rules} />}
              {settings?.cancellation_policy && (
                <Collapsible title="Cancellation policy" body={settings.cancellation_policy} />
              )}
            </Section>
          )}

          {(t.status === "checked_out" || (live && t.check_out <= isoDate(new Date()))) && (
            <ReviewSection trip={t} />
          )}
        </div>

        <aside className="space-y-4">
          <PaymentCard trip={t} />
          <div className="rounded-2xl border border-sand-200 p-4">
            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left hover:bg-sand-100"
            >
              <MessageCircle className="size-5 text-brand-700" />
              <span className="flex-1 text-sm font-medium text-ink">Message host</span>
            </button>
            {t.status === "pending" && (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left text-red-700 hover:bg-red-50"
              >
                <XCircle className="size-5" />
                <span className="flex-1 text-sm font-medium">Withdraw request</span>
              </button>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Withdraw this request?"
        description="The dates go back on sale. If you already paid, message us about your refund."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(t.id, {
                  onSuccess: () => {
                    setConfirmCancel(false);
                    toast.success("Request withdrawn");
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              Withdraw
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          {t.ref} · {prettyDate(t.check_in, "MMM d")} – {prettyDate(t.check_out, "MMM d, yyyy")}
        </p>
      </Modal>
    </div>
  );
}

function PaymentCard({ trip: t }: { trip: Trip }) {
  const { data: settings } = useSettings();
  const { data: payments = [] } = useTripPayments(t.id);
  const attach = useAttachReceipt();
  const [method, setMethod] = useState<PaymentMethod>(t.payment_method ?? "gcash");
  const owing = t.balance > 0.009 && ["pending", "confirmed", "checked_in"].includes(t.status);
  const down = Math.ceil((t.total * (settings?.downpayment_percent ?? 50)) / 100);
  const dueNow = t.paid > 0 ? t.balance : Math.min(down, t.balance);

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-level-2">
      <p className="font-display text-lg text-ink">Payment</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between text-ink-soft">
          <dt>Total</dt>
          <dd className="text-ink">{money(t.total)}</dd>
        </div>
        {payments.map((p, i) => (
          <div key={i} className="flex justify-between text-ink-soft">
            <dt>
              {p.kind === "refund" ? "Refund" : "Paid"} · {METHOD_LABEL[p.method]} · {prettyDate(p.paid_on, "MMM d")}
            </dt>
            <dd className={p.kind === "refund" ? "text-red-700" : "text-emerald-800"}>
              {p.kind === "refund" ? "−" : ""}
              {money(p.amount)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-sand-200 pt-2 text-base font-semibold">
          <dt>Balance</dt>
          <dd className={owing ? "text-terra-600" : "text-ink"}>{money(Math.max(t.balance, 0))}</dd>
        </div>
      </dl>

      {owing && (
        <div className="mt-4 space-y-3 border-t border-sand-200 pt-4">
          <p className="text-sm text-ink-soft">
            {t.paid > 0 ? "Pay the balance before check-in." : `Send at least ${money(dueNow, true)} to secure your dates.`}
          </p>
          {(settings?.gcash_number || settings?.bank_account_number) && (
            <dl className="divide-y divide-sand-200 rounded-xl bg-sand-100 text-xs">
              {settings.gcash_number && (
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-ink-muted">GCash</dt>
                  <dd className="text-right font-medium select-all">
                    {settings.gcash_number}
                    {settings.gcash_name && <span className="block font-normal text-ink-muted">{settings.gcash_name}</span>}
                  </dd>
                </div>
              )}
              {settings.bank_account_number && (
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-ink-muted">{settings.bank_name || "Bank"}</dt>
                  <dd className="text-right font-medium select-all">
                    {settings.bank_account_number}
                    {settings.bank_account_name && (
                      <span className="block font-normal text-ink-muted">{settings.bank_account_name}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <div className="flex gap-2 text-xs">
            {(["gcash", "bank_transfer"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "h-8 flex-1 cursor-pointer rounded-lg border font-medium",
                  method === m ? "border-brand-700 bg-brand-50 text-brand-700" : "border-sand-300 text-ink-soft",
                )}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sand-300 px-3 py-3 text-sm font-medium text-ink hover:border-brand-700">
            {attach.isPending ? (
              "Uploading…"
            ) : (
              <>
                <Upload className="size-4" /> {t.has_receipt ? "Send another receipt" : "Upload payment receipt"}
              </>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              disabled={attach.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) return void toast.error("That file is over 10 MB.");
                attach.mutate(
                  { bookingId: t.id, file, method },
                  {
                    onSuccess: () => toast.success("Receipt sent", { description: "We'll verify it and update your balance." }),
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                );
              }}
            />
          </label>
          {t.has_receipt && (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Receipt className="size-3.5" /> Receipt received. We'll update the balance once it's verified.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewSection({ trip: t }: { trip: Trip }) {
  const save = useSaveReview();
  const [rating, setRating] = useState(t.review_rating ?? 0);
  const [body, setBody] = useState(t.review_body ?? "");
  const [editing, setEditing] = useState(!t.review_rating);
  const published = t.review_status === "published";

  return (
    <Section title="Your review">
      {!editing && t.review_rating ? (
        <div className="rounded-2xl border border-sand-200 p-5">
          <div className="flex items-center justify-between">
            <span className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn("size-4", n <= t.review_rating! ? "fill-brand-700 text-brand-700" : "text-sand-300")} />
              ))}
            </span>
            <span className="text-xs text-ink-muted">
              {published ? "Published on the site" : t.review_status === "hidden" ? "Not shown publicly" : "Waiting to be published"}
            </span>
          </div>
          <p className="mt-3 text-sm whitespace-pre-line text-ink-soft">{t.review_body}</p>
          {t.review_reply && (
            <p className="mt-3 rounded-xl bg-sand-100 px-3 py-2 text-sm text-ink-soft">
              <span className="font-semibold text-ink">Response from Vivienda: </span>
              {t.review_reply}
            </p>
          )}
          {!published && (
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => setEditing(true)}>
              Edit review
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-sand-200 p-5">
          <p className="text-sm text-ink-soft">How was your stay? Your review helps other families and barkadas.</p>
          <div className="mt-4 flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setRating(n)}
                className="cursor-pointer p-0.5"
              >
                <Star className={cn("size-8 transition-colors", n <= rating ? "fill-brand-700 text-brand-700" : "text-sand-300 hover:text-brand-500")} />
              </button>
            ))}
          </div>
          <Textarea
            className="mt-4"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you love? The pool, the rooms, the hosts…"
          />
          <div className="mt-3 flex justify-end gap-2">
            {t.review_rating && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button
              loading={save.isPending}
              disabled={!rating || body.trim().length < 10}
              onClick={() =>
                save.mutate(
                  { bookingId: t.id, rating, body },
                  {
                    onSuccess: () => {
                      setEditing(false);
                      toast.success("Thank you for your review!");
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Submit review
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-sand-200 pb-6 last:border-b-0">
      <h2 className="mb-4 font-display text-xl font-semibold text-brand-700">{title}</h2>
      {children}
    </section>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-brand-700 [&_svg]:size-4">{icon}</span>
      <div>
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className="font-medium text-ink">{value}</dd>
      </div>
    </div>
  );
}

function Collapsible({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-sand-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between py-3 text-left text-sm font-medium text-ink"
      >
        {title}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <p className="pb-4 text-sm leading-relaxed whitespace-pre-line text-ink-soft">{body}</p>}
    </div>
  );
}
