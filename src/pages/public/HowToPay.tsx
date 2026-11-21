import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarCheck, Clock, Copy, Landmark, MessageCircle, ShieldCheck, Smartphone, Upload } from "lucide-react";
import { useSettings } from "../../lib/queries";
import { SITE } from "../../lib/site";

/**
 * How to pay, both ways, as in Malaya's /how-to-pay: the steps for GCash and
 * for a bank transfer, the accounts to send to, and what happens after.
 */
export default function HowToPay() {
  const { data: settings } = useSettings();
  const down = settings?.downpayment_percent ?? 50;
  const hasGcash = Boolean(settings?.gcash_number);
  const hasBank = Boolean(settings?.bank_account_number);
  const phone = settings?.phone || SITE.phone;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-28 sm:px-8 sm:pt-12">
      <p className="eyebrow">Paying for your stay</p>
      <h1 className="site-display mt-2 text-3xl text-brand-700 sm:text-4xl">How to pay.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {down > 0 && down < 100
          ? `Book with a ${down}% downpayment, or pay in full. The rest is due the day before check-in.`
          : "Pay for your stay when you book."}{" "}
        Send it by GCash or bank transfer, then upload the receipt so we can confirm your dates.
      </p>

      <ol className="mt-10 grid gap-4 sm:grid-cols-3">
        <Step n={1} icon={<CalendarCheck />} title="Request your dates">
          Pick your dates on the stay page and send the booking request. We hold the dates while we check.
        </Step>
        <Step n={2} icon={<Smartphone />} title="Send the payment">
          By GCash or bank transfer to the accounts below. Use your confirmation code as the note.
        </Step>
        <Step n={3} icon={<Upload />} title="Upload the receipt">
          A screenshot is fine. Upload it at checkout or later from your trip page. We confirm within 24 hours.
        </Step>
      </ol>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {hasGcash && settings && (
          <Account
            title="GCash"
            mark={<span className="text-xl font-bold tracking-tight text-[#0a5ef0]">GCash</span>}
            rows={[
              ["GCash number", settings.gcash_number],
              ["Account name", settings.gcash_name],
            ]}
            steps={[
              "Open GCash and tap Send, then Express Send.",
              "Enter the number and the amount, and check the account name matches.",
              "Send, then screenshot the receipt.",
            ]}
          />
        )}
        {hasBank && settings && (
          <Account
            title="Bank transfer"
            mark={<Landmark className="size-7 text-ink-soft" />}
            rows={[
              ["Bank", settings.bank_name],
              ["Account name", settings.bank_account_name],
              ["Account number", settings.bank_account_number],
            ]}
            steps={[
              "In your bank app, send to another bank through InstaPay or PESONet (or pay over the counter).",
              "Enter the account number and name exactly as shown.",
              "Keep the confirmation screen or deposit slip.",
            ]}
          />
        )}
        {!hasGcash && !hasBank && (
          <div className="rounded-2xl border border-sand-200 bg-white p-6 text-sm text-ink-soft md:col-span-2">
            Message us and we'll send the payment details for your booking.
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Note icon={<Clock />} title="When it's due">
          {down > 0 && down < 100 ? `${down}% when you book, the balance by the day before check-in.` : "In full when you book."}
        </Note>
        <Note icon={<ShieldCheck />} title="Pay us directly">
          Only to the accounts on this page. We never ask you to pay a personal account over chat.
        </Note>
        <Note icon={<MessageCircle />} title="Need help?">
          Message us from the site or call {phone}.
        </Note>
      </div>

      {settings?.cancellation_policy && (
        <section className="mt-10 rounded-2xl bg-sand-100 p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Cancellations and refunds</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-soft">{settings.cancellation_policy}</p>
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/#stay" className="inline-flex h-11 items-center rounded-full bg-brand-700 px-6 text-sm font-semibold text-sand-50">
          Check dates
        </Link>
        <Link to="/trips" className="inline-flex h-11 items-center rounded-full border border-sand-300 px-6 text-sm font-medium text-ink">
          Upload a receipt from Trips
        </Link>
      </div>
    </div>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-sand-200 bg-white p-5 shadow-level-1">
      <span className="flex items-center gap-2 text-brand-700 [&_svg]:size-5">
        {icon}
        <span className="text-xs font-semibold tracking-wide uppercase">Step {n}</span>
      </span>
      <p className="mt-3 font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{children}</p>
    </li>
  );
}

function Account({ title, mark, rows, steps }: { title: string; mark: ReactNode; rows: [string, string][]; steps: string[] }) {
  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-level-2">
      <div className="flex h-9 items-center">{mark}</div>
      <h2 className="mt-3 font-semibold text-ink">{title}</h2>
      <dl className="mt-4 divide-y divide-sand-200 rounded-xl bg-sand-100 text-sm">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-ink-muted">{k}</dt>
              <dd>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(v).then(() => toast.success(`${k} copied`))}
                  className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-ink"
                  title="Copy"
                >
                  {v} <Copy className="size-3.5 text-ink-muted" />
                </button>
              </dd>
            </div>
          ))}
      </dl>
      <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </section>
  );
}

function Note({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-brand-700 [&_svg]:size-5">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{children}</p>
      </div>
    </div>
  );
}
