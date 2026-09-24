import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { BedDouble, CalendarDays, Check, ChevronDown, FileText, Upload, Users } from "lucide-react";
import { errorMessage, photoUrl, supabase } from "../../lib/supabase";
import { nightlyRate, useRateOverrides, useSettings, useUnavailableNights, useUnits } from "../../lib/queries";
import { compactMoney, isoDate, money, plural, prettyDate, prettyTime } from "../../lib/format";
import { sendBookingEmail } from "../../lib/email";
import { cn } from "../../lib/utils";
import type { PaymentMethod, Quote } from "../../lib/types";
import { RangeCalendar, type DateRange } from "../../components/RangeCalendar";
import { Button, EmptyState, ErrorBox, Field, Input, Spinner, Textarea } from "../../components/ui";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Accepts local (09xx…) and international (+44…) numbers: 7–15 digits. */
function validPhone(p: string) {
  const digits = p.replace(/[^\d]/g, "");
  return /^\+?[\d\s()-]+$/.test(p.trim()) && digits.length >= 7 && digits.length <= 15;
}

type PayChoice = PaymentMethod | "later";

export default function Book() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: settings } = useSettings();
  const { data: allUnits, isLoading } = useUnits();
  const units = useMemo(() => (allUnits ?? []).filter((u) => u.is_active), [allUnits]);

  const unit = units.find((u) => u.slug === params.get("unit")) ?? (units.length === 1 ? units[0] : undefined);
  const today = isoDate(new Date());
  const horizon = isoDate(addDays(new Date(), 400));
  const { data: unavailable } = useUnavailableNights(unit?.id, today, horizon);
  const { data: overrides } = useRateOverrides(unit?.id);

  const [range, setRange] = useState<DateRange>({ checkIn: null, checkOut: null });
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [pay, setPay] = useState<PayChoice>("gcash");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset dates when switching rooms; clamp guests to what the room holds.
  useEffect(() => {
    setRange({ checkIn: null, checkOut: null });
    if (unit) setGuests((g) => Math.min(Math.max(g, 1), unit.max_guests));
  }, [unit?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const downpayment = quote ? Math.ceil((quote.total * (settings?.downpayment_percent ?? 50)) / 100) : 0;

  const errors = {
    dates: !range.checkIn || !range.checkOut ? "Pick your check-in and check-out dates." : null,
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
        p_special_requests: requests.trim(),
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
  if (units.length === 0) {
    return (
      <EmptyState icon={<BedDouble className="size-8" />} title="Online booking opens soon">
        Message us on Facebook to reserve your stay.
      </EmptyState>
    );
  }

  const agreementText =
    settings?.waiver ||
    [
      "By booking you agree to follow the house rules and to be responsible for your group's safety and any damage to the property during your stay.",
      settings?.house_rules,
      settings?.cancellation_policy,
    ]
      .filter(Boolean)
      .join("\n\n");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Book your stay</h1>
      <p className="mt-1 text-ink-muted">Your booking is confirmed once we verify your downpayment.</p>

      <form onSubmit={submit} noValidate className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {units.length > 1 && (
            <Section step={1} title="Choose a room" icon={<BedDouble className="size-4" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                {units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setParams({ unit: u.slug }, { replace: true })}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      unit?.id === u.id
                        ? "border-forest-600 bg-forest-50 ring-1 ring-forest-600"
                        : "border-sand-200 bg-white hover:border-sand-300",
                    )}
                  >
                    <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                      {u.photos[0] && <img src={photoUrl(u.photos[0])} alt="" className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-sm text-ink-muted">
                        {money(u.base_rate, true)}/night · up to {u.max_guests}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section
            step={units.length > 1 ? 2 : 1}
            title="Dates"
            icon={<CalendarDays className="size-4" />}
            error={touched ? errors.dates : null}
          >
            {!unit ? (
              <p className="text-sm text-ink-muted">Choose a room first to see open dates.</p>
            ) : (
              <>
                <RangeCalendar
                  value={range}
                  onChange={setRange}
                  unavailable={unavailable ?? new Set()}
                  dayNote={(iso) => compactMoney(nightlyRate(unit, iso, overrides))}
                />
                <p className="mt-3 text-xs text-ink-muted">
                  Crossed-out dates are taken. Prices shown are per night. Check-in{" "}
                  {prettyTime(settings?.check_in_time ?? "14:00")}, check-out{" "}
                  {prettyTime(settings?.check_out_time ?? "12:00")}.
                </p>
              </>
            )}
          </Section>

          <Section step={units.length > 1 ? 3 : 2} title="Your details" icon={<Users className="size-4" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={touched ? errors.name : null} className="sm:col-span-2">
                {(id) => (
                  <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                )}
              </Field>
              <Field label="Email" error={touched ? errors.email : null}>
                {(id) => (
                  <Input
                    id={id}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
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
              <Field label="Guests" hint={unit ? `This room fits up to ${unit.max_guests}.` : undefined}>
                {(id) => (
                  <div className="flex h-10 items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="size-10 px-0 text-lg"
                      onClick={() => setGuests((g) => Math.max(1, g - 1))}
                      aria-label="Fewer guests"
                    >
                      −
                    </Button>
                    <output id={id} className="w-10 text-center font-medium">
                      {guests}
                    </output>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="size-10 px-0 text-lg"
                      onClick={() => setGuests((g) => Math.min(unit?.max_guests ?? 20, g + 1))}
                      aria-label="More guests"
                    >
                      +
                    </Button>
                  </div>
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
          </Section>

          <Section step={units.length > 1 ? 4 : 3} title="Payment" icon={<Upload className="size-4" />}>
            <div className="grid gap-3 sm:grid-cols-3">
              {hasGcash && <PayOption value="gcash" current={pay} onPick={setPay} label="GCash" />}
              {hasBank && <PayOption value="bank_transfer" current={pay} onPick={setPay} label="Bank transfer" />}
              <PayOption value="later" current={pay} onPick={setPay} label="Pay later" />
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
            {pay === "later" ? (
              <p className="mt-4 text-sm text-ink-muted">
                We'll hold the dates while we review your request and message you how to pay. Unpaid requests may be
                released.
              </p>
            ) : (
              <>
                {settings?.payment_instructions && (
                  <p className="mt-4 text-sm text-ink-soft">{settings.payment_instructions}</p>
                )}
                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sand-300 bg-sand-50 px-4 py-4 hover:border-forest-500">
                  <Upload className="size-5 shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1 text-sm">
                    {receipt ? (
                      <span className="block truncate font-medium">{receipt.name}</span>
                    ) : (
                      <>
                        <span className="font-medium">Upload your receipt</span>
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
              </>
            )}
          </Section>

          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <button
              type="button"
              onClick={() => setShowAgreement((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={showAgreement}
            >
              <span className="flex items-center gap-2 font-medium">
                <FileText className="size-4 text-clay-500" /> Guest agreement
              </span>
              <span className="flex items-center gap-1 text-sm text-ink-muted">
                {showAgreement ? "Hide" : "Read"}
                <ChevronDown className={cn("size-4 transition-transform", showAgreement && "rotate-180")} />
              </span>
            </button>
            {showAgreement && (
              <div className="mt-3 max-h-72 overflow-y-auto rounded-lg bg-sand-50 p-4 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                {agreementText}
              </div>
            )}
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-4 accent-forest-700"
              />
              <span>I have read and agree to the guest agreement, house rules and cancellation policy.</span>
            </label>
            {touched && errors.agreed && <p className="mt-2 text-xs text-red-700">{errors.agreed}</p>}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="font-display text-lg font-semibold">{unit?.name ?? "Your stay"}</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Check-in" value={range.checkIn ? prettyDate(range.checkIn, "EEE, MMM d") : "—"} />
              <Row label="Check-out" value={range.checkOut ? prettyDate(range.checkOut, "EEE, MMM d") : "—"} />
              <Row label="Guests" value={String(guests)} />
            </dl>
            {quote && range.checkOut && (
              <dl className={cn("mt-4 space-y-2 border-t border-sand-200 pt-4 text-sm", quoting && "opacity-60")}>
                <Row label={plural(quote.nights, "night")} value={money(quote.room_total)} />
                {quote.extra_guest_total > 0 && <Row label="Extra guests" value={money(quote.extra_guest_total)} />}
                <div className="flex justify-between border-t border-sand-200 pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{money(quote.total)}</dd>
                </div>
                {pay !== "later" && (settings?.downpayment_percent ?? 0) > 0 && (
                  <Row
                    label={`Downpayment (${settings?.downpayment_percent}%)`}
                    value={money(downpayment)}
                    strong
                  />
                )}
              </dl>
            )}
            <ErrorBox className="mt-4">{submitError}</ErrorBox>
            {touched && firstError && !submitError && (
              <p className="mt-4 text-sm text-red-700">{firstError}</p>
            )}
            <Button type="submit" variant="accent" size="lg" className="mt-5 w-full" loading={submitting}>
              <Check className="size-4" /> Request booking
            </Button>
            <p className="mt-3 text-center text-xs text-ink-muted">You won't be charged by this form.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Section({
  step,
  title,
  icon,
  error,
  children,
}: {
  step: number;
  title: string;
  icon: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border bg-white p-5", error ? "border-red-300" : "border-sand-200")}>
      <h2 className="mb-4 flex items-center gap-2 font-medium">
        <span className="flex size-6 items-center justify-center rounded-full bg-forest-700 text-xs text-sand-50">
          {step}
        </span>
        {title}
        <span className="text-ink-muted">{icon}</span>
      </h2>
      {children}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function PayOption({
  value,
  current,
  onPick,
  label,
}: {
  value: PayChoice;
  current: PayChoice;
  onPick: (v: PayChoice) => void;
  label: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
        active ? "border-forest-600 bg-forest-50 text-forest-700 ring-1 ring-forest-600" : "border-sand-200 hover:border-sand-300",
      )}
    >
      {label}
    </button>
  );
}

function PayDetails({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-4 divide-y divide-sand-200 rounded-xl bg-sand-50 text-sm">
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn(strong && "font-semibold text-clay-600")}>{value}</dd>
    </div>
  );
}
