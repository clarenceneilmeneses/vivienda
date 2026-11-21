import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { useSettings, useUnits } from "../../lib/queries";
import { useAuth } from "../../lib/auth";
import { downloadCsv, isoDate, money, plural } from "../../lib/format";
import {
  categoryLabel,
  METHOD_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  type BookingSource,
  type BookingSummary,
  type Expense,
  type PaymentMethod,
} from "../../lib/types";
import { cn } from "../../lib/utils";
import { Button, Card, Field, Input, PageHeader, Spinner, Switch, Tabs, Textarea } from "../../components/ui";
import { useAllBookings } from "./Bookings";
import {
  AGING,
  agingOf,
  MONTHS,
  monthlyBooks,
  pnlRows,
  shareBy,
  signed,
  useYearBooks,
  type PaymentRow,
} from "./Finance";

/**
 * Reports, after Malaya's (2026-11-21): a report builder on the left, the live
 * A4 preview on the right, and Download PDF. The PDF is the browser's own
 * print-to-PDF: the document is mounted alone under <body> just for the print,
 * so none of the admin chrome comes with it, and the pages carry numbers. No
 * new dependency. CSV exports are the second tab.
 *
 * The builder's settings stay in this browser (localStorage): a convenience,
 * never the only copy of anything.
 */

const STORE = "vivienda.report-builder.v1";

type SectionKey = "summary" | "pnl" | "chart" | "pnlYear" | "collections" | "expenses" | "receivables" | "bookings";
const SECTION_INFO: Record<SectionKey, { label: string; hint: string }> = {
  summary: { label: "Summary", hint: "The headline figures, with the period before" },
  pnl: { label: "Profit & loss", hint: "Income and expenses by category for the period" },
  chart: { label: "Income vs expenses chart", hint: "Month by month, for the year" },
  pnlYear: { label: "P&L by month", hint: "The whole year, a column per month" },
  collections: { label: "Collections", hint: "Every payment, and totals by method" },
  expenses: { label: "Expenses", hint: "Every expense by category, receipt or not" },
  receivables: { label: "Receivables", hint: "Who still owes, and how long" },
  bookings: { label: "Bookings & occupancy", hint: "Stays in the period, by source" },
};
type Section = { key: SectionKey; on: boolean };
const ALL: SectionKey[] = ["summary", "pnl", "chart", "pnlYear", "collections", "expenses", "receivables", "bookings"];
const pick = (...on: SectionKey[]): Section[] => [...on.map((key) => ({ key, on: true })), ...ALL.filter((k) => !on.includes(k)).map((key) => ({ key, on: false }))];

const PRESETS: Record<string, { label: string; hint: string; title: string; sections: Section[] }> = {
  owner: {
    label: "Owner's summary",
    hint: "Everything at a glance for the period",
    title: "Owner's Report",
    sections: pick("summary", "pnl", "chart", "receivables", "bookings"),
  },
  pnl: { label: "Profit & loss", hint: "The P&L for the period and the year by month", title: "Profit & Loss Statement", sections: pick("pnl", "pnlYear", "chart") },
  expenses: { label: "Expense report", hint: "Every expense, by category, with receipts", title: "Expense Report", sections: pick("expenses", "pnl") },
  collections: { label: "Collections report", hint: "Money received, by method", title: "Collections Report", sections: pick("summary", "collections") },
  bookings: { label: "Bookings report", hint: "Stays, occupancy and sources", title: "Bookings Report", sections: pick("summary", "bookings", "receivables") },
};

type PeriodKey = "this-month" | "last-month" | "last-7" | "last-30" | "quarter" | "ytd" | "last-year" | "custom";
const PERIODS: [PeriodKey, string][] = [
  ["this-month", "This month"],
  ["last-month", "Last month"],
  ["last-7", "Last 7 days"],
  ["last-30", "Last 30 days"],
  ["quarter", "This quarter"],
  ["ytd", "Year to date"],
  ["last-year", "Last year"],
  ["custom", "Custom"],
];
const plusDays = (iso: string, n: number) => isoDate(addDays(new Date(`${iso}T00:00:00`), n));
function periodRange(key: PeriodKey, today: string): { from: string; to: string } | null {
  const month = `${today.slice(0, 7)}-01`;
  const y = today.slice(0, 4);
  switch (key) {
    case "this-month":
      return { from: month, to: today };
    case "last-month": {
      const to = plusDays(month, -1);
      return { from: `${to.slice(0, 7)}-01`, to };
    }
    case "last-7":
      return { from: plusDays(today, -6), to: today };
    case "last-30":
      return { from: plusDays(today, -29), to: today };
    case "quarter": {
      const q = String(Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0");
      return { from: `${y}-${q}-01`, to: today };
    }
    case "ytd":
      return { from: `${y}-01-01`, to: today };
    case "last-year":
      return { from: `${Number(y) - 1}-01-01`, to: `${Number(y) - 1}-12-31` };
    default:
      return null;
  }
}

interface Options {
  title: string;
  preparedFor: string;
  notes: string;
  from: string;
  to: string;
  compare: boolean;
  hideGuests: boolean;
  sections: Section[];
}
type Saved = { preset: string; period: PeriodKey; options: Options };

function defaults(today: string, preset = "owner"): Saved {
  const p = PRESETS[preset] ?? PRESETS.owner;
  return {
    preset,
    period: "this-month",
    options: { title: p.title, preparedFor: "", notes: "", ...periodRange("this-month", today)!, compare: true, hideGuests: false, sections: p.sections },
  };
}
function load(today: string): Saved {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaults(today);
    const saved = JSON.parse(raw) as Saved;
    const range = periodRange(saved.period, today); // a preset period moves with the calendar
    const sections = (saved.options.sections ?? []).filter((s) => ALL.includes(s.key));
    ALL.forEach((k) => !sections.some((s) => s.key === k) && sections.push({ key: k, on: false }));
    return { ...saved, options: { ...defaults(today).options, ...saved.options, sections, ...(range ?? {}) } };
  } catch {
    return defaults(today);
  }
}

const longDay = (d: string) => format(new Date(`${d}T00:00:00`), "MMMM d, yyyy");

export default function Reports() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"builder" | "csv">("builder");
  return (
    <>
      <PageHeader
        title="Reports"
        description="Build a formal report and download it as a PDF, or export the raw data as CSV."
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: "builder", label: "Report builder" },
          { value: "csv", label: "CSV exports" },
        ]}
      />
      {tab === "builder" ? <Builder presetParam={params.get("preset")} /> : <CsvExports />}
    </>
  );
}

// ───────────────────────── the builder ─────────────────────────

function Builder({ presetParam }: { presetParam: string | null }) {
  const today = isoDate(new Date());
  const [state, setState] = useState<Saved>(() => (presetParam && PRESETS[presetParam] ? defaults(today, presetParam) : load(today)));
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch {
      /* private window: the builder still works, it just forgets */
    }
  }, [state]);

  const o = state.options;
  const set = (patch: Partial<Options>) => setState((s) => ({ ...s, preset: patch.sections ? "custom" : s.preset, options: { ...s.options, ...patch } }));
  const applyPreset = (key: string) => setState((s) => ({ ...s, preset: key, options: { ...s.options, title: PRESETS[key].title, sections: PRESETS[key].sections } }));
  const setPeriod = (period: PeriodKey) => setState((s) => ({ ...s, period, options: { ...s.options, ...(periodRange(period, today) ?? {}) } }));
  const move = (i: number, by: -1 | 1) => {
    const next = [...o.sections];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ sections: next });
  };
  const datesOk = o.from <= o.to;

  const data = useReportData(o.from, o.to);

  // Download: mount the print copy, give it a beat to lay out, print.
  useEffect(() => {
    if (!printing) return;
    const title = document.title;
    document.title = `${data.resort} ${o.title || "Report"} ${o.from} to ${o.to}`;
    const done = () => {
      document.title = title;
      setPrinting(false);
    };
    window.addEventListener("afterprint", done, { once: true });
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [printing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
      {/* settings */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <Button className="w-full" size="lg" disabled={!datesOk || data.loading} onClick={() => setPrinting(true)}>
          <Download className="size-4" /> Download PDF
        </Button>

        <Panel title="Start from">
          <div className="grid gap-2">
            {Object.entries(PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                aria-pressed={state.preset === key}
                className={cn(
                  "cursor-pointer rounded-xl border px-3 py-2 text-left transition-colors",
                  state.preset === key ? "border-brand-700 bg-brand-50" : "border-sand-200 hover:border-brand-700/40",
                )}
              >
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-ink-muted">{p.hint}</span>
              </button>
            ))}
            {state.preset === "custom" && <p className="text-xs text-ink-muted">Custom: your own sections.</p>}
          </div>
        </Panel>

        <Panel title="Dates">
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                aria-pressed={state.period === key}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors",
                  state.period === key ? "border-brand-700 bg-brand-700 text-sand-50" : "border-sand-300 hover:border-brand-700/40",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="From">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={o.from}
                  onChange={(e) => {
                    setState((s) => ({ ...s, period: "custom" }));
                    set({ from: e.target.value });
                  }}
                />
              )}
            </Field>
            <Field label="To">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={o.to}
                  onChange={(e) => {
                    setState((s) => ({ ...s, period: "custom" }));
                    set({ to: e.target.value });
                  }}
                />
              )}
            </Field>
          </div>
          {!datesOk && <p className="mt-1 text-xs text-red-700">"To" is before "From".</p>}
          <div className="mt-3">
            <Switch checked={o.compare} onChange={(v) => set({ compare: v })} label="Compare with the period before" description="Changes beside the summary figures." />
          </div>
        </Panel>

        <Panel title="Sections">
          <ul className="space-y-1">
            {o.sections.map((s, i) => (
              <li key={s.key} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", s.on && "bg-sand-100/70")}>
                <input
                  type="checkbox"
                  checked={s.on}
                  onChange={(e) => set({ sections: o.sections.map((x) => (x.key === s.key ? { ...x, on: e.target.checked } : x)) })}
                  aria-label={SECTION_INFO[s.key].label}
                  className="size-4 shrink-0 cursor-pointer accent-brand-700"
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", !s.on && "text-ink-muted")}>{SECTION_INFO[s.key].label}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{SECTION_INFO[s.key].hint}</span>
                </span>
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    className="cursor-pointer rounded p-0.5 text-ink-muted hover:bg-sand-200 disabled:cursor-default disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move ${SECTION_INFO[s.key].label} up`}
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer rounded p-0.5 text-ink-muted hover:bg-sand-200 disabled:cursor-default disabled:opacity-30"
                    disabled={i === o.sections.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move ${SECTION_INFO[s.key].label} down`}
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Details">
          <div className="space-y-3">
            <Field label="Report title">{(id) => <Input id={id} value={o.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} />}</Field>
            <Field label="Prepared for" optional>
              {(id) => <Input id={id} value={o.preparedFor} maxLength={80} placeholder="e.g. the owners, or the accountant" onChange={(e) => set({ preparedFor: e.target.value })} />}
            </Field>
            <Field label="Notes" optional hint="Printed before the sign-off.">
              {(id) => <Textarea id={id} rows={3} value={o.notes} maxLength={1500} onChange={(e) => set({ notes: e.target.value })} />}
            </Field>
            <Switch checked={o.hideGuests} onChange={(v) => set({ hideGuests: v })} label="Hide guest names" description="Booking codes only, for sending outside the team." />
            <Button variant="secondary" size="sm" className="w-full" onClick={() => setState(defaults(today))}>
              <RefreshCw className="size-3.5" /> Reset to the default
            </Button>
          </div>
        </Panel>
      </div>

      {/* the live preview */}
      <div className="min-w-0 rounded-2xl bg-sand-200/60 p-3 sm:p-6">
        {data.loading ? (
          <Spinner label="Gathering the numbers" />
        ) : (
          <div className="mx-auto w-full max-w-[210mm] overflow-x-auto bg-white px-5 py-6 text-neutral-900 shadow-level-3 sm:px-[14mm] sm:py-[14mm]">
            <ReportDocument o={o} d={data} />
          </div>
        )}
        <p className="mt-3 text-center text-xs text-ink-muted">Preview. The PDF splits it into A4 pages with page numbers. In the print window, choose “Save as PDF”.</p>
      </div>

      {printing &&
        createPortal(
          <div className="report-print-root">
            <style>{printCss(data.resort)}</style>
            <ReportDocument o={o} d={data} />
          </div>,
          document.body,
        )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</p>
      {children}
    </Card>
  );
}

/** Only the print copy prints: hidden on screen, everything else hidden on paper. */
function printCss(resort: string) {
  const name = resort.replace(/["\\]/g, "");
  return `
.report-print-root { display: none; }
@page { size: A4; margin: 14mm 13mm 16mm;
  @bottom-left { content: "${name} · Confidential"; font: 8pt system-ui, Arial, sans-serif; color: #8a8a85; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt system-ui, Arial, sans-serif; color: #8a8a85; }
}
@media print {
  html, body { background: #fff !important; }
  body > *:not(.report-print-root) { display: none !important; }
  .report-print-root { display: block; color: #171717; }
  .report-print-root section { break-inside: avoid-page; }
  .report-print-root tr { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
}

// ───────────────────────── the numbers ─────────────────────────

interface Period {
  collected: number;
  received: number;
  refunds: number;
  expenses: number;
  net: number;
  margin: number | null;
  made: number;
  madeValue: number;
  nights: number;
  available: number;
  occupancy: number;
  adr: number | null;
  stays: BookingSummary[];
}

function periodNumbers(from: string, to: string, payments: PaymentRow[], expenses: Expense[], bookings: BookingSummary[], activeUnits: number): Period {
  const inP = (iso: string) => iso >= from && iso <= to;
  const pays = payments.filter((p) => inP(p.paid_on));
  const received = pays.filter((p) => p.kind !== "refund").reduce((s, p) => s + p.amount, 0);
  const refunds = pays.filter((p) => p.kind === "refund").reduce((s, p) => s + p.amount, 0);
  const spent = expenses.filter((e) => inP(e.spent_on)).reduce((s, e) => s + e.amount, 0);
  const live = bookings.filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status));
  const end = plusDays(to, 1);
  let nights = 0;
  let revenue = 0;
  const stays: BookingSummary[] = [];
  live.forEach((b) => {
    const st = b.check_in < from ? from : b.check_in;
    const en = b.check_out > end ? end : b.check_out;
    const n = Math.max(0, differenceInCalendarDays(new Date(`${en}T00:00:00`), new Date(`${st}T00:00:00`)));
    if (n > 0) stays.push(b);
    nights += n;
    if (b.nights > 0) revenue += (b.total * n) / b.nights;
  });
  const days = differenceInCalendarDays(new Date(`${to}T00:00:00`), new Date(`${from}T00:00:00`)) + 1;
  const available = Math.max(1, activeUnits) * days;
  const made = live.filter((b) => inP(b.created_at.slice(0, 10)));
  const collected = received - refunds;
  return {
    collected,
    received,
    refunds,
    expenses: spent,
    net: collected - spent,
    margin: collected > 0 ? (collected - spent) / collected : null,
    made: made.length,
    madeValue: made.reduce((s, b) => s + b.total, 0),
    nights,
    available,
    occupancy: nights / available,
    adr: nights ? revenue / nights : null,
    stays: stays.sort((a, b) => a.check_in.localeCompare(b.check_in)),
  };
}

function useReportData(from: string, to: string) {
  const { data: settings } = useSettings();
  const { data: units } = useUnits();
  const { session } = useAuth();
  const { data: bookings, isLoading: lb } = useAllBookings();
  const days = Math.max(1, differenceInCalendarDays(new Date(`${to}T00:00:00`), new Date(`${from}T00:00:00`)) + 1);
  const prevTo = plusDays(from, -1);
  const prevFrom = plusDays(from, -days);
  const year = Number(to.slice(0, 4));
  const { payments: pq, expenses: eq } = useYearBooks(year, prevFrom < from ? prevFrom : from);
  const today = isoDate(new Date());
  return useMemo(() => {
    const payments = pq.data ?? [];
    const expenses = eq.data ?? [];
    const list = bookings ?? [];
    const active = (units ?? []).filter((u) => u.is_active).length;
    const inP = (iso: string) => iso >= from && iso <= to;
    return {
      loading: lb || pq.isLoading || eq.isLoading,
      resort: settings?.resort_name || "Vivienda",
      settings,
      preparedBy: session?.user?.email ?? null,
      generated: `${format(new Date(), "MMMM d, yyyy")} at ${format(new Date(), "h:mm a")}`,
      today,
      year,
      now: periodNumbers(from, to, payments, expenses, list, active),
      before: periodNumbers(prevFrom, prevTo, payments, expenses, list, active),
      compareLabel: `${longDay(prevFrom)} – ${longDay(prevTo)}`,
      payments: payments.filter((p) => inP(p.paid_on)).sort((a, b) => a.paid_on.localeCompare(b.paid_on)),
      expenses: expenses.filter((e) => inP(e.spent_on)).sort((a, b) => a.spent_on.localeCompare(b.spent_on)),
      allPayments: payments,
      allExpenses: expenses,
      unpaid: list.filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status) && b.balance > 0.009).sort((a, b) => a.check_out.localeCompare(b.check_out)),
    };
  }, [pq.data, eq.data, bookings, units, settings, session, from, to, prevFrom, prevTo, year, lb, pq.isLoading, eq.isLoading, today]);
}
type ReportData = ReturnType<typeof useReportData>;

// ───────────────────────── the document ─────────────────────────

const php = (n: number) => money(n);
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

function ReportDocument({ o, d }: { o: Options; d: ReportData }) {
  const guest = (b: { guest_name?: string; ref: string }) => (o.hideGuests ? b.ref : (b.guest_name ?? b.ref));
  const period = o.from === o.to ? longDay(o.from) : `${longDay(o.from)} – ${longDay(o.to)}`;
  const on = o.sections.filter((s) => s.on);
  return (
    <article className="text-[10pt] leading-snug">
      <header className="mb-6 border-b-2 border-neutral-900 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[8pt] tracking-[0.2em] text-neutral-500 uppercase">{d.resort}</p>
            <h1 className="mt-1 font-display text-[20pt] leading-tight">{o.title || "Report"}</h1>
            <p className="mt-1 text-neutral-600">{period}</p>
          </div>
          <div className="text-right text-[8pt] text-neutral-500">
            {d.settings?.address && <p>{d.settings.address}</p>}
            {d.settings?.phone && <p>{d.settings.phone}</p>}
            {d.settings?.email && <p>{d.settings.email}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[8pt] text-neutral-600">
          {o.preparedFor && (
            <span>
              Prepared for: <b className="text-neutral-900">{o.preparedFor}</b>
            </span>
          )}
          {d.preparedBy && <span>Prepared by: {d.preparedBy}</span>}
          <span>Generated {d.generated}</span>
          {o.compare && <span>Compared with {d.compareLabel}</span>}
        </div>
      </header>

      {on.length === 0 && <p className="text-neutral-500">Switch on at least one section.</p>}

      {on.map(({ key }) => (
        <Fragment key={key}>
          {key === "summary" && <SummarySection d={d} compare={o.compare} />}
          {key === "pnl" && <PnlSection d={d} />}
          {key === "chart" && <ChartSection d={d} />}
          {key === "pnlYear" && <PnlYearSection d={d} />}
          {key === "collections" && <CollectionsSection d={d} guest={guest} />}
          {key === "expenses" && <ExpensesSection d={d} />}
          {key === "receivables" && <ReceivablesSection d={d} guest={guest} />}
          {key === "bookings" && <BookingsSection d={d} guest={guest} />}
        </Fragment>
      ))}

      {o.notes.trim() && (
        <section className="mt-6">
          <H2>Notes</H2>
          <p className="whitespace-pre-line text-neutral-700">{o.notes}</p>
        </section>
      )}

      <section className="mt-10 grid grid-cols-2 gap-10 text-[8pt] text-neutral-600">
        {["Prepared by", "Reviewed & approved by"].map((l) => (
          <div key={l}>
            <div className="h-10 border-b border-neutral-400" />
            <p className="mt-1">{l}</p>
            <p className="mt-3">Date: ____________________</p>
          </div>
        ))}
      </section>
    </article>
  );
}

function H2({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-neutral-300 pb-1">
      <h2 className="text-[12pt] font-semibold">{children}</h2>
      {sub && <span className="text-[8pt] text-neutral-500">{sub}</span>}
    </div>
  );
}

function Table({ head, rows, foot, align }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[]; align?: ("l" | "r")[] }) {
  const a = (i: number) => ((align?.[i] ?? (i === 0 ? "l" : "r")) === "r" ? "text-right" : "text-left");
  return (
    <table className="w-full border-collapse text-[8.5pt]">
      <thead>
        <tr className="border-b border-neutral-400 text-neutral-500">
          {head.map((h, i) => (
            <th key={i} className={cn("px-1.5 py-1 font-medium", a(i))}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, j) => (
          <tr key={j} className="border-b border-neutral-200">
            {r.map((c, i) => (
              <td key={i} className={cn("px-1.5 py-1 tabular-nums", a(i))}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr className="border-t-2 border-neutral-900 font-semibold">
            {foot.map((c, i) => (
              <td key={i} className={cn("px-1.5 py-1 tabular-nums", a(i))}>
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  if (!before) return <span className="text-neutral-400">—</span>;
  const ch = (now - before) / Math.abs(before);
  const good = invert ? ch <= 0 : ch >= 0;
  return (
    <span className={good ? "text-emerald-700" : "text-red-700"}>
      {ch >= 0 ? "▲" : "▼"} {Math.abs(ch * 100).toFixed(1)}%
    </span>
  );
}

function SummarySection({ d, compare }: { d: ReportData; compare: boolean }) {
  const n = d.now;
  const b = d.before;
  const tiles: [string, string, ReactNode?][] = [
    ["Collected", php(n.collected), compare && <Delta now={n.collected} before={b.collected} />],
    ["Expenses", php(n.expenses), compare && <Delta now={n.expenses} before={b.expenses} invert />],
    ["Net cash", php(n.net), compare && <Delta now={n.net} before={b.net} />],
    ["Margin", pct(n.margin)],
    ["Bookings made", String(n.made), compare && <Delta now={n.made} before={b.made} />],
    ["Booking value", php(n.madeValue), compare && <Delta now={n.madeValue} before={b.madeValue} />],
    ["Occupancy", pct(n.occupancy), compare && <Delta now={n.occupancy} before={b.occupancy} />],
    ["Avg nightly rate", n.adr == null ? "—" : php(n.adr)],
  ];
  return (
    <section className="mb-6">
      <H2 sub={`${n.nights} of ${n.available} nights sold`}>Summary</H2>
      <div className="grid grid-cols-4 gap-2">
        {tiles.map(([l, v, delta]) => (
          <div key={l} className="rounded border border-neutral-200 px-2.5 py-2">
            <p className="text-[7pt] tracking-wide text-neutral-500 uppercase">{l}</p>
            <p className="mt-0.5 text-[12pt] font-semibold tabular-nums">{v}</p>
            {delta && <p className="text-[7.5pt]">{delta}</p>}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[8pt] text-neutral-500">
        Receivables, all dates: {php(d.unpaid.reduce((s, x) => s + x.balance, 0))} across {plural(d.unpaid.length, "booking")}.
      </p>
    </section>
  );
}

function PnlSection({ d }: { d: ReportData }) {
  const cats = shareBy(d.expenses, (e) => e.category, (e) => e.amount, categoryLabel);
  return (
    <section className="mb-6">
      <H2 sub="Cash basis">Profit & loss</H2>
      <table className="w-full text-[9pt]">
        <tbody>
          <PRow label="Payments received" v={d.now.received} />
          <PRow label="Less refunds" v={-d.now.refunds} />
          <PRow label="Total income" v={d.now.collected} bold />
          <tr>
            <td colSpan={2} className="pt-3 pb-1 text-[8pt] tracking-wide text-neutral-500 uppercase">
              Expenses
            </td>
          </tr>
          {cats.length === 0 && <PRow label="No expenses recorded" v={0} indent />}
          {cats.map((c) => (
            <PRow key={c.label} label={c.label} v={-c.value} indent />
          ))}
          <PRow label="Total expenses" v={-d.now.expenses} bold />
          <tr className="border-t-2 border-neutral-900">
            <td className="py-1.5 font-semibold">Net profit</td>
            <td className={cn("py-1.5 text-right font-semibold tabular-nums", d.now.net < 0 && "text-red-700")}>{php(d.now.net)}</td>
          </tr>
          <tr>
            <td className="text-[8pt] text-neutral-500">Margin</td>
            <td className="text-right text-[8pt] text-neutral-500">{pct(d.now.margin)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
function PRow({ label, v, bold, indent }: { label: string; v: number; bold?: boolean; indent?: boolean }) {
  return (
    <tr className={cn("border-b border-neutral-200", bold && "font-semibold")}>
      <td className={cn("py-1", indent && "pl-4")}>{label}</td>
      <td className={cn("py-1 text-right tabular-nums", v < 0 && !bold && "text-neutral-700")}>{php(v)}</td>
    </tr>
  );
}

function ChartSection({ d }: { d: ReportData }) {
  const m = monthlyBooks(d.year, d.allPayments, d.allExpenses);
  const max = Math.max(1, ...m.flatMap((x) => [x.income, x.expenses]));
  const W = 680;
  const H = 200;
  const pad = { l: 56, b: 22, t: 8 };
  const slot = (W - pad.l) / 12;
  const bw = Math.min(16, slot / 3);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <section className="mb-6">
      <H2 sub={String(d.year)}>Income vs expenses</H2>
      <div className="mb-1 flex gap-4 text-[8pt] text-neutral-600">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: "#7b4821" }} /> Income
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: "#b48a66" }} /> Expenses
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Income and expenses by month, ${d.year}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W} y1={y(t)} y2={y(t)} stroke="#e5e5e5" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#737373">
              {t >= 1000 ? `₱${Math.round(t / 1000)}k` : `₱${Math.round(t)}`}
            </text>
          </g>
        ))}
        {m.map((x, i) => {
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={x.label}>
              <rect x={cx - bw - 1} y={y(x.income)} width={bw} height={Math.max(0, H - pad.b - y(x.income))} rx="2" fill="#7b4821" />
              <rect x={cx + 1} y={y(x.expenses)} width={bw} height={Math.max(0, H - pad.b - y(x.expenses))} rx="2" fill="#b48a66" />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="#737373">
                {x.label}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function PnlYearSection({ d }: { d: ReportData }) {
  const r = pnlRows(d.year, d.allPayments, d.allExpenses);
  const s = (a: number[]) => a.reduce((x, v) => x + v, 0);
  const k = (v: number) => (v === 0 ? "–" : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));
  const row = (label: string, vals: number[], bold = false) => (
    <tr className={cn("border-b border-neutral-200", bold && "font-semibold")}>
      <td className="py-0.5 pr-1 whitespace-nowrap">{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={cn("px-0.5 py-0.5 text-right tabular-nums", v < 0 && "text-red-700")}>
          {k(v)}
        </td>
      ))}
      <td className="py-0.5 pl-1 text-right font-semibold tabular-nums">{k(s(vals))}</td>
    </tr>
  );
  return (
    <section className="mb-6">
      <H2 sub={`${d.year} · figures in pesos, k = thousands`}>P&L by month</H2>
      <table className="w-full text-[7pt]">
        <thead>
          <tr className="border-b border-neutral-400 text-neutral-500">
            <th className="py-0.5 text-left font-medium"> </th>
            {MONTHS.map((m) => (
              <th key={m} className="px-0.5 py-0.5 text-right font-medium">
                {m}
              </th>
            ))}
            <th className="py-0.5 pl-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {row("Income", r.income, true)}
          {r.categories.map((c) => (
            <Fragment key={c.label}>{row(`  ${c.label}`, c.values.map((v) => -v))}</Fragment>
          ))}
          {row("Total expenses", r.totalExp.map((v) => -v), true)}
          {row("Net profit", r.net, true)}
        </tbody>
      </table>
    </section>
  );
}

function CollectionsSection({ d, guest }: { d: ReportData; guest: (b: { guest_name?: string; ref: string }) => string }) {
  const byMethod = shareBy(d.payments, (p) => p.method, signed, (k) => METHOD_LABEL[k as PaymentMethod] ?? k);
  return (
    <section className="mb-6">
      <H2 sub={plural(d.payments.length, "payment")}>Collections</H2>
      <div className="mb-3 flex flex-wrap gap-2">
        {byMethod.map((m) => (
          <span key={m.label} className="rounded border border-neutral-200 px-2 py-1 text-[8pt]">
            {m.label}: <b className="tabular-nums">{php(m.value)}</b>
          </span>
        ))}
      </div>
      <Table
        head={["Date", "Booking", "Method", "Reference", "Receipt", "Amount"]}
        align={["l", "l", "l", "l", "l", "r"]}
        rows={d.payments.map((p) => [
          format(new Date(`${p.paid_on}T00:00:00`), "MMM d"),
          `${p.booking?.ref ?? ""}${p.booking?.guest && guest({ guest_name: p.booking.guest.full_name, ref: "" }) ? ` · ${guest({ guest_name: p.booking.guest.full_name, ref: "" })}` : ""}`,
          METHOD_LABEL[p.method],
          p.reference || "—",
          p.receipt_path ? "Yes" : "—",
          `${p.kind === "refund" ? "−" : ""}${php(p.amount)}`,
        ])}
        foot={["Total", "", "", "", "", php(d.now.collected)]}
      />
    </section>
  );
}

function ExpensesSection({ d }: { d: ReportData }) {
  const groups = new Map<string, Expense[]>();
  d.expenses.forEach((e) => groups.set(e.category, [...(groups.get(e.category) ?? []), e]));
  const missing = d.expenses.filter((e) => !e.receipt_path).length;
  return (
    <section className="mb-6">
      <H2 sub={`${plural(d.expenses.length, "expense")}${missing ? ` · ${missing} without a receipt` : " · all with receipts"}`}>Expenses</H2>
      {d.expenses.length === 0 ? (
        <p className="text-neutral-500">No expenses recorded in this period.</p>
      ) : (
        <Table
          head={["Date", "Description", "Paid to", "Receipt", "Amount"]}
          align={["l", "l", "l", "l", "r"]}
          rows={[...groups.entries()].flatMap(([cat, list]) => [
            [<b key="c">{categoryLabel(cat)}</b>, "", "", "", <b key="t">{php(list.reduce((s, e) => s + e.amount, 0))}</b>],
            ...list.map((e) => [format(new Date(`${e.spent_on}T00:00:00`), "MMM d"), e.description, e.vendor || "—", e.receipt_path ? "Yes" : "Missing", php(e.amount)]),
          ])}
          foot={["Total", "", "", "", php(d.now.expenses)]}
        />
      )}
    </section>
  );
}

function ReceivablesSection({ d, guest }: { d: ReportData; guest: (b: { guest_name?: string; ref: string }) => string }) {
  const total = d.unpaid.reduce((s, b) => s + b.balance, 0);
  return (
    <section className="mb-6">
      <H2 sub={`As of ${longDay(d.today)}`}>Receivables</H2>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {AGING.map((a) => {
          const v = d.unpaid.filter((b) => agingOf(b, d.today) === a.key).reduce((s, b) => s + b.balance, 0);
          return (
            <div key={a.key} className="rounded border border-neutral-200 px-2 py-1.5">
              <p className="text-[7pt] text-neutral-500">{a.label}</p>
              <p className="text-[10pt] font-semibold tabular-nums">{php(v)}</p>
            </div>
          );
        })}
      </div>
      {d.unpaid.length === 0 ? (
        <p className="text-neutral-500">Every guest has paid in full.</p>
      ) : (
        <Table
          head={["Booking", "Stay", "Age", "Total", "Paid", "Balance"]}
          align={["l", "l", "l", "r", "r", "r"]}
          rows={d.unpaid.map((b) => [
            o2(b, guest),
            `${format(new Date(`${b.check_in}T00:00:00`), "MMM d")} – ${format(new Date(`${b.check_out}T00:00:00`), "MMM d")}`,
            AGING.find((a) => a.key === agingOf(b, d.today))?.label ?? "",
            php(b.total),
            php(b.paid),
            php(b.balance),
          ])}
          foot={["Total", "", "", "", "", php(total)]}
        />
      )}
    </section>
  );
}
const o2 = (b: BookingSummary, guest: (b: { guest_name?: string; ref: string }) => string) => (guest(b) === b.ref ? b.ref : `${b.ref} · ${guest(b)}`);

function BookingsSection({ d, guest }: { d: ReportData; guest: (b: { guest_name?: string; ref: string }) => string }) {
  const stays = d.now.stays;
  const bySource = shareBy(stays, (b) => b.source, () => 1, (k) => SOURCE_LABEL[k as BookingSource] ?? k);
  return (
    <section className="mb-6">
      <H2 sub={`${plural(stays.length, "stay")} · occupancy ${pct(d.now.occupancy)} · ${d.now.nights} nights sold`}>Bookings & occupancy</H2>
      <div className="mb-3 flex flex-wrap gap-2">
        {bySource.map((s) => (
          <span key={s.label} className="rounded border border-neutral-200 px-2 py-1 text-[8pt]">
            {s.label}: <b>{s.value}</b>
          </span>
        ))}
      </div>
      {stays.length === 0 ? (
        <p className="text-neutral-500">No stays in this period.</p>
      ) : (
        <Table
          head={["Booking", "Check-in", "Nights", "Guests", "Status", "Total", "Balance"]}
          align={["l", "l", "r", "r", "l", "r", "r"]}
          rows={stays.map((b) => [
            o2(b, guest),
            format(new Date(`${b.check_in}T00:00:00`), "MMM d"),
            b.nights,
            b.guests_count,
            STATUS_LABEL[b.status],
            php(b.total),
            b.balance > 0.009 ? php(b.balance) : "Paid",
          ])}
          foot={["Total", "", stays.reduce((s, b) => s + b.nights, 0), stays.reduce((s, b) => s + b.guests_count, 0), "", php(stays.reduce((s, b) => s + b.total, 0)), ""]}
        />
      )}
    </section>
  );
}

// ───────────────────────── CSV exports ─────────────────────────

function CsvExports() {
  const today = isoDate(new Date());
  const [period, setPeriod] = useState<PeriodKey>("this-month");
  const [custom, setCustom] = useState(periodRange("this-month", today)!);
  const r = period === "custom" ? custom : periodRange(period, today)!;
  const d = useReportData(r.from, r.to);
  const stamp = `${r.from}_${r.to}`;
  const exports: { title: string; hint: string; run: () => void }[] = [
    {
      title: "Payments",
      hint: "Every payment and refund, with method and reference",
      run: () =>
        downloadCsv(`payments-${stamp}.csv`, [
          ["Date", "Type", "Amount", "Method", "Booking", "Guest", "Reference", "Receipt", "Notes"],
          ...d.payments.map((p) => [p.paid_on, p.kind, signed(p), METHOD_LABEL[p.method], p.booking?.ref, p.booking?.guest?.full_name, p.reference, p.receipt_path ? "Yes" : "No", p.notes]),
        ]),
    },
    {
      title: "Expenses",
      hint: "Every expense, by category, receipt or not",
      run: () =>
        downloadCsv(`expenses-${stamp}.csv`, [
          ["Date", "Category", "Description", "Vendor", "Amount", "Receipt", "Notes"],
          ...d.expenses.map((e) => [e.spent_on, categoryLabel(e.category), e.description, e.vendor, e.amount, e.receipt_path ? "Yes" : "No", e.notes]),
        ]),
    },
    {
      title: "Bookings",
      hint: "Stays with a night in the dates",
      run: () =>
        downloadCsv(`bookings-${stamp}.csv`, [
          ["Ref", "Guest", "Email", "Phone", "Check-in", "Check-out", "Nights", "Guests", "Status", "Source", "Total", "Paid", "Balance"],
          ...d.now.stays.map((b) => [b.ref, b.guest_name, b.guest_email, b.guest_phone, b.check_in, b.check_out, b.nights, b.guests_count, STATUS_LABEL[b.status], SOURCE_LABEL[b.source], b.total, b.paid, b.balance]),
        ]),
    },
    {
      title: "Receivables",
      hint: "Who still owes today, with the age of the debt (any dates)",
      run: () =>
        downloadCsv(`receivables-${today}.csv`, [
          ["Ref", "Guest", "Phone", "Check-in", "Check-out", "Age", "Total", "Paid", "Balance"],
          ...d.unpaid.map((b) => [b.ref, b.guest_name, b.guest_phone, b.check_in, b.check_out, AGING.find((a) => a.key === agingOf(b, today))?.label, b.total, b.paid, b.balance]),
        ]),
    },
    {
      title: `P&L by month · ${d.year}`,
      hint: "Income, expenses by category and net, a column per month",
      run: () => {
        const p = pnlRows(d.year, d.allPayments, d.allExpenses);
        const s = (a: number[]) => a.reduce((x, v) => x + v, 0);
        downloadCsv(`pnl-${d.year}.csv`, [
          ["", ...MONTHS, "Total"],
          ["Payments received", ...p.received, s(p.received)],
          ["Refunds", ...p.refunds.map((v) => -v), -s(p.refunds)],
          ["Income", ...p.income, s(p.income)],
          ...p.categories.map((c) => [c.label, ...c.values, s(c.values)]),
          ["Total expenses", ...p.totalExp, s(p.totalExp)],
          ["Net profit", ...p.net, s(p.net)],
        ]);
      },
    },
  ];
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Dates</p>
        <div className="flex flex-wrap items-end gap-2">
          {PERIODS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              aria-pressed={period === key}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs",
                period === key ? "border-brand-700 bg-brand-700 text-sand-50" : "border-sand-300 hover:border-brand-700/40",
              )}
            >
              {label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex gap-2">
              <Input type="date" aria-label="From" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-8 w-40" />
              <Input type="date" aria-label="To" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-8 w-40" />
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {longDay(r.from)} – {longDay(r.to)}
        </p>
      </Card>
      {d.loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exports.map((x) => (
            <Card key={x.title} className="flex items-start gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <FileSpreadsheet className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{x.title}</p>
                <p className="text-xs text-ink-muted">{x.hint}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={x.run}>
                  <Download className="size-3.5" /> Download CSV
                </Button>
              </div>
            </Card>
          ))}
          <Card className="flex items-start gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand-100 text-ink-muted">
              <FileText className="size-5" />
            </span>
            <p className="text-xs text-ink-muted">CSV files open in Excel and Google Sheets. For a formatted report to print or send, use the Report builder tab.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
