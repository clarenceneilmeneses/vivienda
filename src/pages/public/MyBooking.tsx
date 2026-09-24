import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Search } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { useSettings } from "../../lib/queries";
import { money, plural, prettyDate, prettyTime, nightsBetween } from "../../lib/format";
import type { BookingStatus } from "../../lib/types";
import { Button, Card, ErrorBox, Field, Input, Spinner, StatusBadge } from "../../components/ui";

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

  const [formRef, setFormRef] = useState(ref);
  const [formEmail, setFormEmail] = useState(email);

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

  function lookup(e: FormEvent) {
    e.preventDefault();
    setParams({ ref: formRef.trim().toUpperCase(), email: formEmail.trim() });
  }

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

      {!isNew && <h1 className="site-display mb-6 text-3xl text-brand-700 sm:text-4xl">My booking.</h1>}

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
        <Card className="p-5">
          {ref && email && !isLoading && (
            <ErrorBox className="mb-4">
              {error ? errorMessage(error) : "We couldn't find a booking with that reference and email."}
            </ErrorBox>
          )}
          <form onSubmit={lookup} className="space-y-4">
            <Field label="Booking reference" hint="It looks like VIV-7K3Q9P and is in your confirmation email.">
              {(id) => (
                <Input
                  id={id}
                  value={formRef}
                  onChange={(e) => setFormRef(e.target.value)}
                  className="font-mono uppercase"
                  required
                />
              )}
            </Field>
            <Field label="Email used for booking">
              {(id) => (
                <Input id={id} type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
              )}
            </Field>
            <Button type="submit" className="w-full">
              <Search className="size-4" /> Find my booking
            </Button>
          </form>
        </Card>
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
