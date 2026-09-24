import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Info,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  Moon,
  Upload,
  Users,
} from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { money, nightsBetween, plural, prettyDate } from "../../lib/format";
import { sendBookingEmail } from "../../lib/email";
import { LOCATION_LABEL } from "../../lib/site";
import { cn } from "../../lib/utils";
import type { PaymentMethod, Quote } from "../../lib/types";
import { ErrorBox, Field, Input, Spinner, Textarea } from "../../components/ui";
import { unitPhotos } from "../../components/public/StayBits";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Accepts local (09xx…) and international (+44…) numbers: 7–15 digits. */
function validPhone(p: string) {
  const digits = p.replace(/[^\d]/g, "");
  return /^\+?[\d\s()-]+$/.test(p.trim()) && digits.length >= 7 && digits.length <= 15;
}

type PayChoice = PaymentMethod | "later";

export default function Book() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: settings } = useSettings();
  const { data: allUnits, isLoading } = useUnits();
  const units = useMemo(() => (allUnits ?? []).filter((u) => u.is_active), [allUnits]);

  const unit = units.find((u) => u.slug === params.get("unit")) ?? (units.length === 1 ? units[0] : undefined);

  // Dates and guests arrive from the stay page; changing them means going back there.
  const range = { checkIn: params.get("in"), checkOut: params.get("out") };
  const guests = Math.max(1, Math.min(Number(params.get("guests")) || 2, unit?.max_guests ?? 99));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [pay, setPay] = useState<PayChoice>("gcash");
  const [amount, setAmount] = useState<"down" | "full">("down");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ["quote", unit?.id, range.checkIn, range.checkOut, guests],
    enabled: Boolean(unit && range.checkIn && range.checkOut),
    queryFn: async (): Promise<Quote> => {
      const { data, error } = await supabase.rpc("quote_stay", {
        p_unit: unit!.id,
        p_check_in: range.checkIn,
        p_check_out: range.checkOut,
        p_guests: guests,
      });
      if (error) throw error;
      const row = (data as Quote[])[0];
      return {
        nights: Number(row.nights),
        room_total: Number(row.room_total),
        extra_guest_total: Number(row.extra_guest_total),
        total: Number(row.total),
      };
    },
  });

  const hasGcash = Boolean(settings?.gcash_number);
  const hasBank = Boolean(settings?.bank_account_number);
  useEffect(() => {
    if (!settings) return;
    if (pay === "gcash" && !hasGcash) setPay(hasBank ? "bank_transfer" : "later");
  }, [settings, hasGcash, hasBank, pay]);

  const downPercent = settings?.downpayment_percent ?? 50;
  const downpayment = quote ? Math.ceil((quote.total * downPercent) / 100) : 0;

  const errors = {
    name: name.trim() ? null : "Please enter your full name.",
    email: EMAIL_RE.test(email.trim()) ? null : "Please enter a valid email so we can send your confirmation.",
    phone: validPhone(phone) ? null : "Enter a mobile number, e.g. 0917 123 4567 or +44 7700 900123.",
    agreed: agreed ? null : "Please read and accept the guest agreement.",
  };
  const firstError = Object.values(errors).find(Boolean) ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);
    if (!unit || firstError) return;
    setSubmitting(true);
    try {
      let receiptPath: string | null = null;
      if (receipt && pay !== "later") {
        const ext = receipt.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("receipts").upload(path, receipt, {
          contentType: receipt.type || undefined,
        });
        if (error) throw new Error(`Couldn't upload the receipt: ${error.message}`);
        receiptPath = path;
      }
      const { data, error } = await supabase.rpc("create_booking", {
        p_unit: unit.id,
        p_check_in: range.checkIn,
        p_check_out: range.checkOut,
        p_guests: guests,
        p_full_name: name.trim(),
        p_email: email.trim(),
        p_phone: phone.trim(),
        p_special_requests: [requests.trim(), pay !== "later" && amount === "full" ? "Paying in full." : ""]
          .filter(Boolean)
          .join(" "),
        p_payment_method: pay === "later" ? null : pay,
        p_receipt_path: receiptPath,
        p_waiver_accepted: agreed,
      });
      if (error) throw error;
      const created = (data as { id: string; ref: string }[])[0];
      // Emails go out in the background; the booking is already safe.
      void sendBookingEmail("booking_received", created.id);
      void sendBookingEmail("new_booking_admin", created.id);
      navigate(`/my-booking?ref=${created.ref}&email=${encodeURIComponent(email.trim())}&new=1`);
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  if (!unit) return <Navigate to="/#stay" replace />;
  if (!range.checkIn || !range.checkOut) return <Navigate to={`/stay/${unit.slug}?guests=${guests}`} replace />;

  const agreementText =
    settings?.waiver ||
    [
      "By booking you agree to follow the house rules and to be responsible for your group's safety and any damage to the property during your stay.",
      settings?.house_rules,
      settings?.cancellation_policy,
    ]
      .filter(Boolean)
      .join("\n\n");

  const photo = unitPhotos(unit)[0]!;
  const nights = quote?.nights ?? nightsBetween(range.checkIn, range.checkOut);
  const backHref = `/stay/${unit.slug}?in=${range.checkIn}&out=${range.checkOut}&guests=${guests}`;
  const dueNow = amount === "full" || downPercent === 0 ? (quote?.total ?? 0) : downpayment;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <Link to={backHref} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand-700">
        <ArrowLeft className="size-4" /> Back to {unit.name}
      </Link>
      <h1 className="mt-4 font-sans text-3xl font-semibold text-ink sm:text-4xl">Secure your booking</h1>
      <p className="mt-2 text-ink-soft">Add your details, choose how you'll pay, and send your request.</p>

      {/* Stay summary */}
      <div className="mt-8 flex flex-col gap-5 rounded-2xl border border-sand-200/80 bg-white p-4 shadow-level-2 sm:p-5 md:flex-row md:items-center">
        <img src={photo} alt="" className="aspect-[4/3] w-full rounded-xl object-cover md:w-48" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-ink">{unit.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="size-4" /> {LOCATION_LABEL}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-sand-200">
            <Fact icon={<CalendarDays />} label="Check-in" value={prettyDate(range.checkIn, "MMM d, yyyy")} />
            <Fact icon={<CalendarDays />} label="Check-out" value={prettyDate(range.checkOut, "MMM d, yyyy")} />
            <Fact icon={<Users />} label="Guests" value={plural(guests, "guest")} />
            <Fact icon={<Moon />} label="Nights" value={plural(nights, "night")} />
          </dl>
        </div>
        <div className="border-t border-sand-200 pt-4 text-center md:w-48 md:border-t-0 md:border-l md:pt-0 md:pl-5">
          <p className="text-sm text-ink-muted">Total amount</p>
          <p className={cn("mt-1 text-3xl font-semibold text-ink", quoting && "opacity-50")}>
            {quote ? money(quote.total, true) : "—"}
          </p>
          <p className="mt-2 border-t border-sand-200 pt-2 text-xs text-ink-muted">All amounts in PHP</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="mt-10 space-y-10">
        <Step n={1} title="Your details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={touched ? errors.name : null} className="sm:col-span-2">
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
            </Field>
            <Field label="Email" error={touched ? errors.email : null}>
              {(id) => (
                <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              )}
            </Field>
            <Field label="Mobile number" error={touched ? errors.phone : null} hint="Local or international.">
              {(id) => (
                <Input
                  id={id}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="0917 123 4567"
                />
              )}
            </Field>
            <Field label="Special requests" optional className="sm:col-span-2">
              {(id) => (
                <Textarea
                  id={id}
                  value={requests}
                  onChange={(e) => setRequests(e.target.value)}
                  placeholder="Arrival time, celebrations, extra bedding…"
                />
              )}
            </Field>
          </div>
        </Step>

        <Step n={2} title="Choose payment method">
          <div className="grid gap-3 sm:grid-cols-3">
            {hasGcash && (
              <PayCard value="gcash" current={pay} onPick={setPay} title="GCash" note="Send to our GCash number">
                <span className="text-xl font-bold tracking-tight text-[#0a5ef0]">GCash</span>
              </PayCard>
            )}
            {hasBank && (
              <PayCard
                value="bank_transfer"
                current={pay}
                onPick={setPay}
                title="Bank transfer"
                note={settings?.bank_name || "Online or over the counter"}
              >
                <Landmark className="size-7 text-ink-soft" />
              </PayCard>
            )}
            <PayCard value="later" current={pay} onPick={setPay} title="Pay later" note="We'll message you how to pay">
              <Clock className="size-7 text-ink-soft" />
            </PayCard>
          </div>
          {pay === "gcash" && settings && (
            <PayDetails
              rows={[
                ["GCash number", settings.gcash_number],
                ["Account name", settings.gcash_name],
              ]}
            />
          )}
          {pay === "bank_transfer" && settings && (
            <PayDetails
              rows={[
                ["Bank", settings.bank_name],
                ["Account name", settings.bank_account_name],
                ["Account number", settings.bank_account_number],
              ]}
            />
          )}
          {pay === "later" && (
            <p className="mt-4 rounded-xl bg-sand-100 px-4 py-3 text-sm text-ink-soft">
              We'll hold the dates while we review your request and message you how to pay. Unpaid requests may be released.
            </p>
          )}
        </Step>

        {pay !== "later" && quote && (
          <Step n={3} title="Choose payment amount">
            <div className="grid gap-3 sm:grid-cols-2">
              {downPercent > 0 && downPercent < 100 && (
                <AmountCard
                  active={amount === "down"}
                  onPick={() => setAmount("down")}
                  title={`Pay ${downPercent}% now`}
                  badge="Recommended"
                  note="Secure your booking today."
                  value={money(downpayment, true)}
                  sub={`Due today (${downPercent}%)`}
                />
              )}
              <AmountCard
                active={amount === "full" || downPercent === 0 || downPercent >= 100}
                onPick={() => setAmount("full")}
                title="Pay in full"
                note="Settle everything now."
                value={money(quote.total, true)}
                sub="Due today (100%)"
              />
            </div>
            <p className="mt-4 flex items-center gap-3 rounded-xl bg-sand-100 px-4 py-3 text-sm text-ink-soft">
              <Info className="size-4 shrink-0" /> Any remaining balance is paid before check-in.
            </p>
            {settings?.payment_instructions && <p className="mt-3 text-sm text-ink-soft">{settings.payment_instructions}</p>}

            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-white px-4 py-4 hover:border-brand-700">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-700/10 text-brand-700">
                <Upload className="size-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm">
                {receipt ? (
                  <span className="block truncate font-medium">{receipt.name}</span>
                ) : (
                  <>
                    <span className="font-medium">Upload your receipt for {money(dueNow, true)}</span>
                    <span className="block text-ink-muted">Screenshot or PDF, up to 10 MB. You can also send it later.</span>
                  </>
                )}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 10 * 1024 * 1024) {
                    setSubmitError("That file is over 10 MB. Try a screenshot instead.");
                    return;
                  }
                  setReceipt(f);
                }}
              />
            </label>
          </Step>
        )}

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-base text-ink">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-brand-700"
            />
            <span>
              I agree to the{" "}
              <button
                type="button"
                onClick={() => setShowAgreement((v) => !v)}
                className="cursor-pointer underline underline-offset-4 hover:text-brand-700"
                aria-expanded={showAgreement}
              >
                guest agreement
              </button>
              , house rules and cancellation policy.
            </span>
          </label>
          {showAgreement && (
            <div className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-sand-100 p-4 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
              {agreementText}
            </div>
          )}
          {touched && errors.agreed && <p className="mt-2 text-sm text-red-700">{errors.agreed}</p>}
        </div>

        <div>
          <ErrorBox className="mb-4">{submitError}</ErrorBox>
          {touched && firstError && !submitError && <p className="mb-4 text-sm text-red-700">{firstError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-14 w-full cursor-pointer items-center justify-between rounded-xl bg-ink px-6 text-lg font-medium text-white shadow-level-3 transition-colors hover:bg-ink/90 disabled:opacity-60"
          >
            <span className="flex-1 text-center">{submitting ? "Sending…" : "Request booking"}</span>
            {submitting ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
          </button>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-muted">
            <Lock className="size-4" /> Your booking is confirmed once we verify your payment.
          </p>
        </div>
      </form>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-sans text-lg font-semibold text-ink">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="sm:px-4 sm:first:pl-0">
      <dt className="flex items-center gap-1.5 text-xs text-ink-muted [&_svg]:size-3.5">
        {icon} {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function PayCard({
  value,
  current,
  onPick,
  title,
  note,
  children,
}: {
  value: PayChoice;
  current: PayChoice;
  onPick: (v: PayChoice) => void;
  title: string;
  note: string;
  children: ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      aria-pressed={active}
      className={cn(
        "relative flex cursor-pointer flex-col items-center rounded-2xl border bg-white px-4 pt-7 pb-5 text-center transition-colors",
        active ? "border-brand-700 ring-1 ring-brand-700" : "border-sand-200 hover:border-sand-300",
      )}
    >
      <Radio on={active} className="absolute top-3 right-3" />
      <span className="flex h-9 items-center">{children}</span>
      <span className="mt-3 font-semibold text-ink">{title}</span>
      <span className="mt-1 text-xs text-ink-muted">{note}</span>
    </button>
  );
}

function AmountCard({
  active,
  onPick,
  title,
  badge,
  note,
  value,
  sub,
}: {
  active: boolean;
  onPick: () => void;
  title: string;
  badge?: string;
  note: string;
  value: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-5 text-left transition-colors",
        active ? "border-brand-700/60 bg-brand-50" : "border-sand-200 bg-white hover:border-sand-300",
      )}
    >
      <Radio on={active} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {title}
          {badge && <span className="rounded-md bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-ink-soft">{badge}</span>}
        </span>
        <span className="mt-1 block text-sm text-ink-muted">{note}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold text-ink">{value}</span>
        <span className="mt-1 block text-xs text-ink-muted">{sub}</span>
      </span>
    </button>
  );
}

function Radio({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-2",
        on ? "border-brand-700" : "border-sand-300",
        className,
      )}
    >
      {on && <span className="size-2.5 rounded-full bg-brand-700" />}
    </span>
  );
}

function PayDetails({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-4 divide-y divide-sand-200 rounded-xl bg-sand-100 text-sm">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="font-medium select-all">{v}</dd>
          </div>
        ))}
    </dl>
  );
}
