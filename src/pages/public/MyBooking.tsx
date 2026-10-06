import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Hash, Mail, MailCheck, MessageCircle, Search } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useGuestUi } from "../../components/public/GuestContext";
import { errorMessage, supabase } from "../../lib/supabase";
import { useSettings } from "../../lib/queries";
import { money, plural, prettyDate, prettyTime, nightsBetween } from "../../lib/format";
import type { BookingStatus } from "../../lib/types";
import { Button, Card, ErrorBox, Input, Spinner, StatusBadge } from "../../components/ui";

interface StatusRow {
  ref: string;
  status: BookingStatus;
  unit_name: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  total: number;
  paid: number;
  balance: number;
  guest_name: string;
}

const STATUS_NOTE: Record<BookingStatus, string> = {
  pending: "We've received your request and are checking your payment. You'll get an email once it's confirmed.",
  confirmed: "You're all set. We look forward to hosting you!",
  checked_in: "Enjoy your stay!",
  checked_out: "Thank you for staying with us.",
  cancelled: "This booking was cancelled.",
  declined: "We couldn't accept this booking. Please message us if you have questions.",
};

export default function MyBooking() {
  const [params, setParams] = useSearchParams();
  const ref = params.get("ref") ?? "";
  const email = params.get("email") ?? "";
  const isNew = params.get("new") === "1";
  const { data: settings } = useSettings();
  const { session, isAdmin } = useAuth();
  const { signIn } = useGuestUi();


  const { data, isLoading, error } = useQuery({
    queryKey: ["booking_status", ref, email],
    enabled: Boolean(ref && email),
    queryFn: async (): Promise<StatusRow | null> => {
      const { data, error } = await supabase.rpc("booking_status", { p_ref: ref, p_email: email });
      if (error) throw error;
      const row = (data as StatusRow[])[0];
      return row ? { ...row, total: Number(row.total), paid: Number(row.paid), balance: Number(row.balance) } : null;
    },
  });

  // Signed in, every booking is already in Trips.
  if (session && !isAdmin && !ref) return <Navigate to="/trips" replace />;

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      {isNew && data && (
        <div className="mb-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-brand-700" />
          <h1 className="site-display mt-3 text-3xl text-brand-700">Request received.</h1>
          <p className="mt-2 text-ink-muted">
            We've emailed a copy to <span className="font-medium text-ink">{email}</span>. Keep your booking reference
            handy.
          </p>
        </div>
      )}

      {!isNew && data && <h1 className="site-display text-brand-heading mb-6 text-3xl sm:text-4xl">Your booking</h1>}

      {ref && email && isLoading ? (
        <Spinner />
      ) : data ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-espresso px-5 py-4 text-cream">
            <div>
              <p className="text-xs tracking-wide uppercase opacity-75">Booking reference</p>
              <p className="font-mono text-xl font-semibold tracking-wider">{data.ref}</p>
            </div>
            <StatusBadge status={data.status} />
          </div>
          <div className="space-y-5 p-5">
            <p className="text-sm text-ink-soft">{STATUS_NOTE[data.status]}</p>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Item label="Guest" value={data.guest_name} />
              <Item label="Room" value={data.unit_name} />
              <Item
                label="Check-in"
                value={`${prettyDate(data.check_in, "EEE, MMM d, yyyy")} · ${prettyTime(settings?.check_in_time ?? "14:00")}`}
              />
              <Item
                label="Check-out"
                value={`${prettyDate(data.check_out, "EEE, MMM d, yyyy")} · ${prettyTime(settings?.check_out_time ?? "12:00")}`}
              />
              <Item label="Stay" value={`${plural(nightsBetween(data.check_in, data.check_out), "night")}, ${plural(data.guests_count, "guest")}`} />
            </dl>
            <dl className="space-y-2 border-t border-sand-200 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Total</dt>
                <dd className="font-medium">{money(data.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Paid (verified)</dt>
                <dd>{money(data.paid)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Balance</dt>
                <dd>{money(data.balance)}</dd>
              </div>
            </dl>
            {(settings?.facebook_url || settings?.phone) && (
              <p className="text-xs text-ink-muted">
                Need to change something? {settings?.phone && <>Call or text {settings.phone}</>}
                {settings?.phone && settings?.facebook_url && " or "}
                {settings?.facebook_url && (
                  <a href={settings.facebook_url} target="_blank" rel="noreferrer" className="underline">
                    message us on Facebook
                  </a>
                )}
                .
              </p>
            )}
          </div>
        </Card>
      ) : (
        <FindBooking
          notFound={Boolean(ref && email && !isLoading)}
          error={error ? errorMessage(error) : null}
          initialEmail={email}
          onLookup={(r, e) => setParams({ ref: r.trim().toUpperCase(), email: e.trim() })}
        />
      )}

      {data && !session && (
        <div className="mt-6 flex items-start gap-4 rounded-2xl border border-sand-200 bg-sand-50 p-5">
          <MessageCircle className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">Track this booking and message us here</p>
            <p className="mt-1 text-sm text-ink-soft">
              Create a free account with <span className="font-medium text-ink">{email}</span>. This booking and any
              others under that email appear in Trips, and you can chat with us anytime.
            </p>
            <button
              type="button"
              onClick={() => signIn({ mode: "signup" })}
              className="mt-3 inline-flex h-9 cursor-pointer items-center rounded-full bg-brand-700 px-4 text-sm font-medium text-sand-50"
            >
              Create account
            </button>
          </div>
        </div>
      )}

      {data && (
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-ink-muted hover:text-ink hover:underline">
            Back to home
          </Link>
        </p>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

/**
 * Finding a booking without remembering a code: type the email you booked
 * with and we send a one-tap sign-in link. Opening it signs you in (an
 * account is made if there isn't one) and every booking under that email is
 * waiting in Trips. The confirmation-code lookup is still there, one tap away.
 */
function FindBooking({
  notFound,
  error,
  initialEmail,
  onLookup,
}: {
  notFound: boolean;
  error: string | null;
  initialEmail: string;
  onLookup: (ref: string, email: string) => void;
}) {
  const { signIn } = useGuestUi();
  const [mode, setMode] = useState<"link" | "code">(notFound ? "code" : "link");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setProblem("Enter the email you booked with.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: { emailRedirectTo: `${window.location.origin}/trips`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setProblem(errorMessage(error));
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-level-3">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-700/10 text-brand-700">
          <MailCheck className="size-7" />
        </span>
        <h1 className="site-display text-brand-heading mt-5 text-3xl">Check your email</h1>
        <p className="mx-auto mt-3 max-w-[34ch] text-sm text-ink-soft">
          We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Open it on this device and
          your bookings will be waiting in Trips.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-6 cursor-pointer text-sm font-medium text-ink underline underline-offset-4"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-level-3 sm:p-8">
      {mode === "link" ? (
        <>
          <h1 className="site-display text-brand-heading text-3xl sm:text-4xl">Find your booking</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Enter the email you booked with. We'll send you a link that opens all your bookings, no code or password
            needed.
          </p>
          <form onSubmit={sendLink} noValidate className="mt-6 space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-muted" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                aria-label="Email you booked with"
                className="h-12 rounded-full pl-11 text-base"
              />
            </div>
            <ErrorBox>{problem}</ErrorBox>
            <Button type="submit" size="lg" loading={busy} className="w-full rounded-full">
              Email me a link
            </Button>
          </form>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-sand-200 pt-5 text-sm">
            <button
              type="button"
              onClick={() => setMode("code")}
              className="inline-flex cursor-pointer items-center gap-1.5 text-ink-soft hover:text-ink"
            >
              <Hash className="size-4" /> I have my confirmation code
            </button>
            <button type="button" onClick={() => signIn()} className="cursor-pointer text-ink-soft hover:text-ink">
              Sign in with a password
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setMode("link")}
            className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          <h1 className="site-display text-brand-heading text-3xl">Look up by code</h1>
          <p className="mt-2 text-sm text-ink-soft">The code is in your confirmation email and looks like VIV-7K3Q9P.</p>
          {notFound && <ErrorBox className="mt-4">{error ?? "We couldn't find a booking with that code and email."}</ErrorBox>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim() && email.trim()) onLookup(code, email);
            }}
            className="mt-5 space-y-3"
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VIV-XXXXXX"
              aria-label="Confirmation code"
              className="h-12 rounded-full px-5 font-mono text-base uppercase"
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email you booked with"
              aria-label="Email you booked with"
              className="h-12 rounded-full px-5 text-base"
            />
            <Button type="submit" size="lg" className="w-full rounded-full" disabled={!code.trim() || !email.trim()}>
              <Search className="size-4" /> Find booking
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
