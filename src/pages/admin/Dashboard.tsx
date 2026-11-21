import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfMonth, subMonths } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  EyeOff,
  Hourglass,
  Info,
  LogIn,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { isoDate, money, plural, stayRange } from "../../lib/format";
import { METHOD_LABEL, type BookingSummary, type PaymentMethod } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Badge, Button, Card, CardHeader, EmptyState, Modal, Spinner, StatusBadge } from "../../components/ui";
import { IncomeExpenseChart, type MonthPoint } from "../../components/admin/Charts";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { useAllBookings } from "./Bookings";
import { useInboxUnread } from "../../lib/admin-badges";
import { useAdminRange } from "../../lib/admin-range";

/**
 * The Dashboard, laid out as Malaya's (2026-11-21):
 *   1. the action strip: what needs doing, red before amber, a green ✓ for what's clear
 *   2. month to date: Financial KPI and Performance KPI as two rows of dense tiles
 *   3. trends: the last six months, and who's coming
 *   4. daily numbers at the bottom, any day, hideable
 */

const LIVE = ["confirmed", "checked_in", "checked_out"];
const DAILY_HIDDEN_KEY = "vivienda.dashboard.dailyHidden";

export default function Dashboard() {
  const { data: settings } = useSettings();
  const { data: bookings, isLoading } = useAllBookings();
  const { data: units } = useUnits();
  const { data: unread = 0 } = useInboxUnread();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dailyHidden, setDailyHidden] = useState(() => {
    try {
      return localStorage.getItem(DAILY_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  function hideDaily(v: boolean) {
    setDailyHidden(v);
    try {
      localStorage.setItem(DAILY_HIDDEN_KEY, v ? "1" : "0");
    } catch {
      /* private window: just for this visit */
    }
  }

  const now = new Date();
  const today = isoDate(now);
  const range = useAdminRange();

  const { data: cash } = useQuery({
    queryKey: ["payments", "dashboard-mtd", range.from, range.to],
    queryFn: async () => {
      const [p, e] = await Promise.all([
        supabase.from("payments").select("amount, kind").gte("paid_on", range.from).lte("paid_on", range.to),
        supabase.from("expenses").select("amount").gte("spent_on", range.from).lte("spent_on", range.to),
      ]);
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      return {
        collected: p.data.reduce((s, x) => s + (x.kind === "refund" ? -1 : 1) * Number(x.amount), 0),
        expenses: e.data.reduce((s, x) => s + Number(x.amount), 0),
      };
    },
  });

  const sixMonthsAgo = isoDate(startOfMonth(subMonths(now, 5)));
  const { data: money6 } = useQuery({
    queryKey: ["payments", "dashboard", sixMonthsAgo],
    queryFn: async () => {
      const [p, e] = await Promise.all([
        supabase.from("payments").select("amount, kind, paid_on").gte("paid_on", sixMonthsAgo),
        supabase.from("expenses").select("amount, spent_on").gte("spent_on", sixMonthsAgo),
      ]);
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      return { payments: p.data, expenses: e.data };
    },
  });

  const chart: MonthPoint[] = useMemo(() => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(startOfMonth(now), 5 - i);
      return { key: format(d, "yyyy-MM"), label: format(d, "MMM"), income: 0, expenses: 0 };
    });
    money6?.payments.forEach((p) => {
      const pt = pts.find((x) => x.key === p.paid_on.slice(0, 7));
      if (pt) pt.income += (p.kind === "refund" ? -1 : 1) * Number(p.amount);
    });
    money6?.expenses.forEach((e) => {
      const pt = pts.find((x) => x.key === e.spent_on.slice(0, 7));
      if (pt) pt.expenses += Number(e.amount);
    });
    return pts;
  }, [money6]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMemo(() => {
    const list = bookings ?? [];
    const live = list.filter((b) => LIVE.includes(b.status));
    const activeUnits = Math.max(1, (units ?? []).filter((u) => u.is_active).length);
    const endExclusive = isoDate(addDays(new Date(`${range.to}T00:00:00`), 1));
    let nights = 0;
    let stayRevenue = 0;
    let stays = 0;
    let guests = 0;
    live.forEach((b) => {
      const st = b.check_in < range.from ? range.from : b.check_in;
      const en = b.check_out > endExclusive ? endExclusive : b.check_out;
      const n = Math.max(0, Math.round((new Date(`${en}T00:00:00`).getTime() - new Date(`${st}T00:00:00`).getTime()) / 86_400_000));
      if (n > 0) {
        stays++;
        guests += b.guests_count;
      }
      nights += n;
      if (b.nights > 0) stayRevenue += (b.total * n) / b.nights;
    });
    const available = activeUnits * range.days;
    const made = live.filter((b) => b.created_at.slice(0, 10) >= range.from && b.created_at.slice(0, 10) <= range.to);
    const receivables = live.filter((b) => b.balance > 0.009);
    return {
      nights,
      available,
      stayRevenue,
      stays,
      guests,
      occupancy: available ? nights / available : 0,
      adr: nights ? stayRevenue / nights : null,
      revpar: available ? stayRevenue / available : null,
      avgStay: stays ? live.filter((b) => b.check_in >= range.from && b.check_in <= range.to).reduce((s, b, _, a) => s + b.nights / a.length, 0) : 0,
      made,
      bookingValue: made.reduce((s, b) => s + b.total, 0),
      receivables: receivables.reduce((s, b) => s + b.balance, 0),
      receivablesCount: receivables.length,
    };
  }, [bookings, units, range.from, range.to, range.days]);

  if (isLoading) return <Spinner />;

  const collected = cash?.collected ?? 0;
  const expenses = cash?.expenses ?? 0;
  const netCash = collected - expenses;
  const projectedNet = m.stayRevenue - expenses;

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-brand-50 text-brand-700 ring-1 ring-brand-700/20 ring-inset">{settings?.resort_name ?? "Vivienda"}</Badge>
        <span className="text-xs text-ink-muted">
          {format(now, "EEEE, MMMM d")} · live from bookings and payments · the dates come from the top bar
        </span>
      </div>

      {/* 1 · The action strip, first thing on the page */}
      <ActionStrip bookings={bookings ?? []} today={today} unread={unread} onOpenBooking={setOpenId} />

      {/* 2 · Month to date */}
      <section aria-label="Month to date">
        <SectionHeading eyebrow={`${range.name} · ${range.label}`} title="Resort performance" />

        <p className="eyebrow mb-2">Financial KPI</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          <Tile label="Collected" value={money(collected, true)} to="/admin/finance?tab=payments" formula="Payments received in these dates, less refunds." />
          <Tile
            label="Booking value"
            value={money(m.bookingValue, true)}
            sub={plural(m.made.length, "booking")}
            to="/admin/bookings?view=all"
            formula="The total of confirmed bookings made in these dates, whatever month the stay is in."
          />
          <Tile
            label="Receivables"
            value={money(m.receivables, true)}
            sub={m.receivablesCount ? plural(m.receivablesCount, "booking") : "All paid"}
            tone={m.receivables > 0 ? -1 : undefined}
            to="/admin/finance?tab=unpaid"
            formula="Balances still owed on confirmed, in-house and past stays, any dates."
          />
          <Tile
            label="Projected revenue"
            value={money(m.stayRevenue, true)}
            sub="stays in these dates"
            formula="What the nights in these dates are worth once paid in full: each stay's total spread over its nights."
          />
          <Tile label="Expenses" value={money(expenses, true)} to="/admin/finance?tab=expenses" formula="Expenses recorded in these dates." />
          <Tile label="Net cash" value={money(netCash, true)} tone={netCash} to="/admin/finance?tab=pnl" formula="Collected − expenses." />
          <Tile label="Projected net" value={money(projectedNet, true)} tone={projectedNet} formula="Projected revenue − expenses." />
        </div>

        <p className="eyebrow mt-5 mb-2">Performance KPI</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Tile
            label="Confirmed bookings"
            value={String(m.made.length)}
            sub="Booked in these dates"
            to="/admin/bookings?view=all"
            formula="Bookings made in these dates (by booking date) that are confirmed or later. Pending, cancelled and declined are not counted."
          />
          <Tile
            label="Occupancy"
            value={`${(m.occupancy * 100).toFixed(1)}%`}
            sub={`${m.nights} of ${m.available} nights`}
            to="/admin/calendar"
            formula="Nights sold ÷ nights available. A stay across the edge of the dates counts only its nights inside."
          />
          <Tile label="ADR" value={m.adr == null ? "—" : money(m.adr, true)} sub="Average daily rate" formula="Stay revenue ÷ nights sold." />
          <Tile label="RevPAR" value={m.revpar == null ? "—" : money(m.revpar, true)} sub="Revenue per available night" formula="Stay revenue ÷ nights available. The same as occupancy × ADR." />
          <Tile label="Guests hosted" value={String(m.guests)} sub={plural(m.stays, "stay")} formula="Guests on stays with a night in these dates." />
          <Tile
            label="Avg length of stay"
            value={m.avgStay ? `${m.avgStay.toFixed(1)} nights` : "—"}
            sub="Arrivals in these dates"
            formula="Nights per booking, for stays arriving in these dates."
          />
        </div>
      </section>

      {/* 3 · Trends */}
      <section>
        <SectionHeading eyebrow="The bigger picture" title="Trends & arrivals" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader
              title="Income vs expenses"
              description="Last 6 months"
              action={
                <Link to="/admin/finance" className="link-action inline-flex items-center gap-1 text-xs">
                  Finance <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className="p-4">
              <IncomeExpenseChart data={chart} />
            </div>
          </Card>
          <ComingUp bookings={bookings ?? []} today={today} onOpen={setOpenId} />
        </div>
      </section>

      {/* 4 · Daily numbers, at the very bottom and hideable */}
      {dailyHidden ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-sand-300 px-4 py-3 text-sm text-ink-muted">
          <span>Daily numbers is hidden.</span>
          <Button variant="secondary" size="sm" onClick={() => hideDaily(false)}>
            Show daily numbers
          </Button>
        </div>
      ) : (
        <DailyNumbers bookings={bookings ?? []} today={today} onHide={() => hideDaily(true)} onOpen={setOpenId} />
      )}

      <BookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

// ───────────────────────── pieces ─────────────────────────

function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="font-display text-lg text-ink sm:text-xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Malaya's dense tile: muted label, the value carries the weight, only a negative takes colour. */
function Tile({
  label,
  value,
  sub,
  tone,
  to,
  formula,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Pass the raw number to colour a negative result. */
  tone?: number;
  to?: string;
  formula?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
        {formula && <Info className="size-3 shrink-0 text-ink-muted" aria-label={`How ${label} is worked out`} />}
      </div>
      <p className={cn("mt-1 font-display text-lg tabular-nums", tone !== undefined && tone < 0 ? "text-terra-600" : "text-ink")}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-ink-muted">{sub}</p>}
    </>
  );
  const cls = "block rounded-xl border border-sand-200/80 bg-white p-3 shadow-level-1";
  return to ? (
    <Link to={to} title={formula} className={cn("lift hover:border-brand-700/40", cls)}>
      {body}
    </Link>
  ) : (
    <div title={formula} className={cls}>
      {body}
    </div>
  );
}

// ───────────────────────── action strip ─────────────────────────

type Tone = "urgent" | "verify";
const TONE: Record<Tone, { chip: string; icon: string; amount: string }> = {
  urgent: { chip: "border-red-300 bg-red-50 hover:bg-red-100/70", icon: "bg-red-100 text-red-700", amount: "text-red-700" },
  verify: { chip: "border-amber-300 bg-amber-50 hover:bg-amber-100/70", icon: "bg-amber-100 text-amber-800", amount: "text-amber-800" },
};

interface Concern {
  key: string;
  tone: Tone;
  icon: LucideIcon;
  title: string;
  sub: string;
  amount: string;
  rows?: { b: BookingSummary; note: string }[];
  to?: string;
}

function ActionStrip({
  bookings,
  today,
  unread,
  onOpenBooking,
}: {
  bookings: BookingSummary[];
  today: string;
  unread: number;
  onOpenBooking: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState<Concern | null>(null);
  const first = (b: BookingSummary) => b.guest_name.split(" ")[0];

  // Red: money owed by guests in house or arriving today, and stays gone past their date.
  const owing = bookings.filter(
    (b) => b.balance > 0.009 && (b.status === "checked_in" || (b.status === "confirmed" && b.check_in <= today)),
  );
  const overdue = bookings.filter(
    (b) => (b.status === "checked_in" && b.check_out < today) || (b.status === "confirmed" && b.check_in < today),
  );
  // Amber: things to look at today.
  const requests = bookings.filter((b) => b.status === "pending").sort((a, b) => a.check_in.localeCompare(b.check_in));
  const arriving = bookings.filter((b) => b.status === "confirmed" && b.check_in === today);
  const leaving = bookings.filter((b) => b.status === "checked_in" && b.check_out === today);

  const concerns: Concern[] = [];
  if (overdue.length)
    concerns.push({
      key: "overdue",
      tone: "urgent",
      icon: AlertTriangle,
      title: `${plural(overdue.length, "stay")} past ${overdue.length === 1 ? "its" : "their"} date`,
      sub: overdue.map((b) => `${first(b)} · ${b.status === "checked_in" ? "not checked out" : "not checked in"}`).slice(0, 2).join(" · "),
      amount: "",
      rows: overdue.map((b) => ({
        b,
        note: b.status === "checked_in" ? `Check-out was ${stayDay(b.check_out, today)}` : `Arrival was ${stayDay(b.check_in, today)}`,
      })),
    });
  if (owing.length) {
    const inHouse = owing.filter((b) => b.status === "checked_in").length;
    concerns.push({
      key: "owing",
      tone: "urgent",
      icon: AlertTriangle,
      title: `${plural(owing.length, "guest")} with a balance`,
      sub: [
        inHouse ? `${inHouse} checked in` : null,
        owing.length - inHouse ? `${owing.length - inHouse} arriving today` : null,
        owing.length <= 2 ? owing.map((b) => b.guest_name).join(", ") : null,
      ]
        .filter(Boolean)
        .join(" · "),
      amount: money(owing.reduce((s, b) => s + b.balance, 0), true),
      rows: owing.map((b) => ({ b, note: `${money(b.balance, true)} of ${money(b.total, true)} due` })),
    });
  }
  if (requests.length)
    concerns.push({
      key: "requests",
      tone: "verify",
      icon: Hourglass,
      title: `${plural(requests.length, "request")} to confirm`,
      sub: requests
        .slice(0, 2)
        .map((b) => `${first(b)} · ${stayRange(b.check_in, b.check_out)}`)
        .join(" · "),
      amount: money(requests.reduce((s, b) => s + b.total, 0), true),
      rows: requests.map((b) => ({ b, note: `${plural(b.guests_count, "guest")} · ${money(b.total, true)}` })),
    });
  if (arriving.length || leaving.length)
    concerns.push({
      key: "today",
      tone: "verify",
      icon: LogIn,
      title: [arriving.length && plural(arriving.length, "arrival"), leaving.length && plural(leaving.length, "check-out")]
        .filter(Boolean)
        .join(" and ") + " today",
      sub: [...arriving, ...leaving].slice(0, 3).map(first).join(", "),
      amount: "",
      rows: [
        ...arriving.map((b) => ({ b, note: "Arriving · check in" })),
        ...leaving.map((b) => ({ b, note: "Leaving · check out" })),
      ],
    });
  if (unread)
    concerns.push({
      key: "messages",
      tone: "verify",
      icon: MessageSquare,
      title: `${plural(unread, "conversation")} waiting for a reply`,
      sub: "Guests messaging from the website",
      amount: "",
      to: "/admin/inbox",
    });

  return (
    <section aria-label="Needs action" className="flex flex-wrap items-center gap-2.5">
      {concerns.map((c) => (
        <Chip key={c.key} c={c} onOpen={() => (c.to ? navigate(c.to) : setOpen(c))} />
      ))}
      {!overdue.length && !owing.length && <Clear>Every guest in house has paid in full</Clear>}
      {!requests.length && <Clear>No requests waiting</Clear>}
      {!arriving.length && !leaving.length && <Clear>No arrivals or check-outs today</Clear>}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.title ?? ""} description={open?.sub} size="lg">
        <ul className="-mx-6 -my-5 divide-y divide-sand-200/80">
          {open?.rows?.map(({ b, note }) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(null);
                  onOpenBooking(b.id);
                }}
                className="group flex w-full cursor-pointer items-center gap-3 px-6 py-3 text-left hover:bg-sand-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{b.guest_name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {stayRange(b.check_in, b.check_out)} · {b.ref} · {note}
                  </span>
                </span>
                <StatusBadge status={b.status} />
                <ChevronRight className="size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}

function Chip({ c, onOpen }: { c: Concern; onOpen: () => void }) {
  const t = TONE[c.tone];
  const Icon = c.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("group flex min-w-0 flex-1 basis-80 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors", t.chip)}
    >
      <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full", t.icon)}>
        <Icon className="size-4" aria-hidden />
        {c.tone === "urgent" && <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-red-600 ring-2 ring-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink max-sm:line-clamp-2 sm:truncate">{c.title}</span>
        {c.sub && <span className="block truncate text-xs text-ink-muted">{c.sub}</span>}
      </span>
      {c.amount && <span className={cn("shrink-0 text-sm font-semibold tabular-nums", t.amount)}>{c.amount}</span>}
      <ChevronRight className="size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function Clear({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs text-ink">
      <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
      {children}
    </span>
  );
}

// ───────────────────────── coming up ─────────────────────────

function ComingUp({ bookings, today, onOpen }: { bookings: BookingSummary[]; today: string; onOpen: (id: string) => void }) {
  const in7 = isoDate(addDays(new Date(`${today}T00:00:00`), 7));
  const list = bookings
    .filter((b) => (b.status === "confirmed" || b.status === "pending") && b.check_in > today && b.check_in <= in7)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Arriving in the next 7 days"
        description={list.length ? plural(list.length, "arrival") : undefined}
        action={
          <Link to="/admin/calendar" className="link-action inline-flex items-center gap-1 text-xs">
            Calendar <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState icon={<ClipboardCheck />} title="No arrivals this week" />
      ) : (
        <ul className="max-h-80 divide-y divide-sand-200/80 overflow-y-auto">
          {list.map((b) => (
            <li key={b.id}>
              <button onClick={() => onOpen(b.id)} className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left hover:bg-sand-50">
                <span className="w-20 shrink-0 text-sm font-medium text-brand-700">{stayDay(b.check_in, today, true)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{b.guest_name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {plural(b.nights, "night")} · {plural(b.guests_count, "guest")}
                    {b.balance > 0.009 && <span className="text-terra-600"> · {money(b.balance, true)} due</span>}
                  </span>
                </span>
                <StatusBadge status={b.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ───────────────────────── daily numbers ─────────────────────────

interface DayPayment {
  id: string;
  amount: number;
  kind: string;
  method: PaymentMethod;
  booking_id: string;
  booking: { ref: string; guest: { full_name: string } | null } | null;
}

function DailyNumbers({
  bookings,
  today,
  onHide,
  onOpen,
}: {
  bookings: BookingSummary[];
  today: string;
  onHide: () => void;
  onOpen: (id: string) => void;
}) {
  const [day, setDay] = useState(today);
  useEffect(() => setDay(today), [today]);
  const shift = (n: number) => setDay(isoDate(addDays(new Date(`${day}T00:00:00`), n)));

  const { data, isLoading } = useQuery({
    queryKey: ["payments", "daily", day],
    queryFn: async () => {
      const [p, e] = await Promise.all([
        supabase
          .from("payments")
          .select("id, amount, kind, method, booking_id, booking:bookings(ref, guest:guests(full_name))")
          .eq("paid_on", day),
        supabase.from("expenses").select("amount").eq("spent_on", day),
      ]);
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      return {
        payments: (p.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as unknown as DayPayment[],
        expenses: e.data.reduce((s, x) => s + Number(x.amount), 0),
      };
    },
  });

  const payments = data?.payments ?? [];
  const collected = payments.reduce((s, p) => s + (p.kind === "refund" ? -1 : 1) * p.amount, 0);
  const spent = data?.expenses ?? 0;
  const live = bookings.filter((b) => LIVE.includes(b.status));
  const arrivals = live.filter((b) => b.check_in === day);
  const departures = live.filter((b) => b.check_out === day);
  const staying = live.filter((b) => b.check_in <= day && b.check_out > day);
  const made = bookings.filter((b) => b.created_at.slice(0, 10) === day && !["cancelled", "declined"].includes(b.status));
  const byMethod = new Map<PaymentMethod, number>();
  payments.forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + (p.kind === "refund" ? -1 : 1) * p.amount));

  return (
    <section aria-label="Daily numbers">
      <SectionHeading
        eyebrow={format(new Date(`${day}T00:00:00`), "EEEE, MMMM d, yyyy")}
        title="Daily numbers"
        action={
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label="Day before">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-20 text-center text-sm font-medium">{stayDay(day, today, true)}</span>
            <Button variant="secondary" size="sm" onClick={() => shift(1)} disabled={day >= today} aria-label="Day after">
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onHide}>
              <EyeOff className="size-4" /> Hide
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Tile label="Collected" value={isLoading ? "…" : money(collected, true)} sub={plural(payments.length, "payment")} />
        <Tile label="Expenses" value={isLoading ? "…" : money(spent, true)} />
        <Tile label="Net" value={isLoading ? "…" : money(collected - spent, true)} tone={collected - spent} />
        <Tile label="New bookings" value={String(made.length)} sub={made.length ? money(made.reduce((s, b) => s + b.total, 0), true) : undefined} />
        <Tile label="Arrivals" value={String(arrivals.length)} sub={arrivals.map((b) => b.guest_name.split(" ")[0]).join(", ") || undefined} />
        <Tile label="Check-outs" value={String(departures.length)} sub={departures.map((b) => b.guest_name.split(" ")[0]).join(", ") || undefined} />
        <Tile
          label="Staying that night"
          value={String(staying.reduce((s, b) => s + b.guests_count, 0))}
          sub={staying.length ? plural(staying.length, "booking") : "Open"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Where the money landed" />
          {byMethod.size === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Nothing collected this day.</p>
          ) : (
            <ul className="divide-y divide-sand-200/80">
              {[...byMethod.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([method, amt]) => (
                  <li key={method} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span>{METHOD_LABEL[method] ?? method}</span>
                    <span className="font-medium tabular-nums">{money(amt)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Payments" description={payments.length ? money(collected) : undefined} />
          {payments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">No payments recorded this day.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-sand-200/80 overflow-y-auto">
              {payments.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onOpen(p.booking_id)} className="flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-sand-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.booking?.guest?.full_name ?? "—"}</span>
                      <span className="block truncate font-mono text-xs text-ink-muted">
                        {p.booking?.ref} · {METHOD_LABEL[p.method] ?? p.method}
                      </span>
                    </span>
                    <span className={cn("tabular-nums", p.kind === "refund" && "text-red-700")}>
                      {p.kind === "refund" ? "−" : ""}
                      {money(p.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

/** "Today", "Tomorrow", "Yesterday", or "Mon, Nov 24". Lowercase mid-sentence unless `cap`. */
function stayDay(iso: string, today: string, cap = false) {
  const t = new Date(`${today}T00:00:00`);
  const word =
    iso === today
      ? "today"
      : iso === isoDate(addDays(t, 1))
        ? "tomorrow"
        : iso === isoDate(addDays(t, -1))
          ? "yesterday"
          : format(new Date(`${iso}T00:00:00`), "EEE, MMM d");
  return cap ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}
