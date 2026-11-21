import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfMonth, subMonths } from "date-fns";
import { ArrowRight, BedDouble, TrendingUp, Users, Wallet } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { compactMoney, isoDate, money, plural, stayRange } from "../../lib/format";
import type { BookingSummary } from "../../lib/types";
import { Card, CardHeader, EmptyState, Spinner, StatTile, StatusBadge } from "../../components/ui";
import { IncomeExpenseChart, type MonthPoint } from "../../components/admin/Charts";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { useAllBookings } from "./Bookings";
import { useInboxUnread } from "../../lib/admin-badges";
import { ActionStrip } from "../../components/admin/ActionStrip";
import { useAdminRange } from "../../lib/admin-range";

export default function Dashboard() {
  const { data: settings } = useSettings();
  const { data: bookings, isLoading } = useAllBookings();
  const { data: units } = useUnits();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: unreadMessages = 0 } = useInboxUnread();

  const now = new Date();
  const today = isoDate(now);
  // The top bar's dates. "Month" below means whatever range is picked there.
  const range = useAdminRange();
  const monthStart = range.from;
  const monthEnd = range.to;
  // The same number of days just before, for the "vs" line.
  const prevFrom = isoDate(addDays(new Date(`${range.from}T00:00:00`), -range.days));
  const prevTo = isoDate(addDays(new Date(`${range.from}T00:00:00`), -1));
  const { data: rangeMoney } = useQuery({
    queryKey: ["payments", "dashboard-range", prevFrom, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("amount, kind, paid_on").gte("paid_on", prevFrom).lte("paid_on", range.to);
      if (error) throw error;
      const sum = (a: string, b: string) =>
        data.filter((p) => p.paid_on >= a && p.paid_on <= b).reduce((s, p) => s + (p.kind === "refund" ? -1 : 1) * Number(p.amount), 0);
      return { now: sum(range.from, range.to), before: sum(prevFrom, prevTo) };
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


  const stats = useMemo(() => {
    const list = bookings ?? [];
    const pending = list.filter((b) => b.status === "pending");
    const arrivals = list
      .filter((b) => (b.status === "confirmed" || b.status === "pending") && b.check_in >= today && b.check_in <= isoDate(addDays(now, 7)))
      .sort((a, b) => a.check_in.localeCompare(b.check_in));
    const departures = list.filter((b) => b.status === "checked_in" && b.check_out <= today);
    const arrivingToday = list.filter((b) => b.status === "confirmed" && b.check_in <= today);
    const inHouse = list.filter((b) => b.status === "checked_in");
    const unpaid = list.filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status) && b.balance > 0.009);

    // Occupancy: sold nights this month / (active rooms × days in month).
    const activeUnits = (units ?? []).filter((u) => u.is_active).length;
    const daysInMonth = range.days;
    let nights = 0;
    // Stay revenue earned this month: each booking's total, spread over its nights.
    let revenue = 0;
    list
      .filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status))
      .forEach((b) => {
        const s = b.check_in < monthStart ? monthStart : b.check_in;
        const endExclusive = isoDate(addDays(new Date(`${monthEnd}T00:00:00`), 1));
        const e = b.check_out > endExclusive ? endExclusive : b.check_out;
        const n = Math.max(0, Math.round((new Date(`${e}T00:00:00`).getTime() - new Date(`${s}T00:00:00`).getTime()) / 86_400_000));
        nights += n;
        if (b.nights > 0) revenue += (b.total * n) / b.nights;
      });
    const occupancy = activeUnits ? Math.round((nights / (activeUnits * daysInMonth)) * 100) : 0;
    // Bookings made this month, whatever their dates (as in Malaya's Performance KPI).
    const made = list.filter(
      (b) => b.created_at.slice(0, 10) >= monthStart && b.created_at.slice(0, 10) <= monthEnd && !["cancelled", "declined"].includes(b.status),
    );
    const adr = nights ? revenue / nights : 0;
    const revpar = activeUnits ? revenue / (activeUnits * daysInMonth) : 0;

    return {
      pending,
      arrivals,
      departures,
      arrivingToday,
      inHouse,
      unpaid,
      unpaidTotal: unpaid.reduce((s, b) => s + b.balance, 0),
      occupancy,
      nights,
      revenue,
      made,
      madeValue: made.reduce((s, b) => s + b.total, 0),
      adr,
      revpar,
    };
  }, [bookings, units, today, monthStart, monthEnd, range.days]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Spinner />;

  const income = rangeMoney?.now ?? 0;
  const incomeChange =
    rangeMoney && rangeMoney.before > 0 ? Math.round(((rangeMoney.now - rangeMoney.before) / rangeMoney.before) * 100) : null;
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mb-6">
        <p className="eyebrow mb-1">
          {format(now, "EEEE, MMMM d")} · {settings?.resort_name}
        </p>
        <h1 className="font-display text-2xl font-medium sm:text-[28px]">{greeting}</h1>
      </div>

      <ActionStrip
        unread={unreadMessages}
        requests={stats.pending}
        arrivals={stats.arrivingToday}
        departures={stats.departures}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label={`Income · ${range.name}`}
          icon={<TrendingUp />}
          value={money(income, true)}
          sub={incomeChange != null ? `${incomeChange >= 0 ? "+" : ""}${incomeChange}% vs the days before` : undefined}
        />
        <StatTile
          label="Occupancy"
          icon={<BedDouble />}
          value={`${stats.occupancy}%`}
          sub={`${plural(stats.nights, "night")} sold · ${range.name.toLowerCase()}`}
        />
        <StatTile
          label="In house now"
          icon={<Users />}
          value={String(stats.inHouse.length)}
          sub={plural(stats.inHouse.reduce((s, b) => s + b.guests_count, 0), "guest")}
        />
        <Link to="/admin/finance" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-700">
          <StatTile
            label="Unpaid balances"
            icon={<Wallet />}
            tone={stats.unpaidTotal > 0 ? "warn" : "default"}
            value={money(stats.unpaidTotal, true)}
            sub={plural(stats.unpaid.length, "booking")}
          />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title={`Performance · ${range.name}`}
            description={`${range.label}. Stays count on the nights they fall in; bookings made counts requests sent in these dates.`}
          />
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl bg-sand-200/80 sm:grid-cols-4">
            <Kpi
              label="Bookings made"
              value={String(stats.made.length)}
              sub={stats.made.length ? `${compactMoney(stats.madeValue)} booked` : "None yet"}
            />
            <Kpi label="Occupancy" value={`${stats.occupancy}%`} sub={`${plural(stats.nights, "night")} sold`} />
            <Kpi
              label="Avg nightly rate"
              value={stats.nights ? money(stats.adr, true) : "—"}
              sub="ADR: stay income ÷ nights sold"
            />
            <Kpi label="RevPAR" value={money(stats.revpar, true)} sub="Stay income ÷ nights in the dates" />
          </dl>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Unsettled balances"
            description={stats.unpaid.length ? `${money(stats.unpaidTotal, true)} across ${plural(stats.unpaid.length, "booking")}` : undefined}
          />
          {stats.unpaid.length === 0 ? (
            <EmptyState title="Everyone is paid up" />
          ) : (
            <ul className="max-h-64 divide-y divide-sand-200/80 overflow-y-auto">
              {[...stats.unpaid]
                .sort((a, b) => a.check_in.localeCompare(b.check_in))
                .map((b) => (
                  <li key={b.id}>
                    <button onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-sand-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{b.guest_name}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {stayRange(b.check_in, b.check_out)} · {b.ref}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-terra-600">{money(b.balance, true)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Arriving in the next 7 days"
            action={
              <Link to="/admin/calendar" className="link-action inline-flex items-center gap-1 text-xs">
                Calendar <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {stats.arrivals.length === 0 ? (
            <EmptyState title="No arrivals this week" />
          ) : (
            <ul className="divide-y divide-sand-200/80">
              {stats.arrivals.map((b) => (
                <ArrivalRow key={b.id} b={b} today={today} onOpen={() => setOpenId(b.id)} />
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Last 6 months"
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
      </div>

      <BookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function ArrivalRow({ b, today, onOpen }: { b: BookingSummary; today: string; onOpen: () => void }) {
  const tomorrow = isoDate(addDays(new Date(), 1));
  const when = b.check_in === today ? "Today" : b.check_in === tomorrow ? "Tomorrow" : format(new Date(`${b.check_in}T00:00:00`), "EEE, MMM d");
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-sand-50">
        <div className="w-20 shrink-0 text-sm font-medium text-brand-700">{when}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{b.guest_name}</p>
          <p className="truncate text-xs text-ink-muted">
            {b.unit_name} · {stayRange(b.check_in, b.check_out)} · {plural(b.guests_count, "guest")}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <StatusBadge status={b.status} />
          {b.balance > 0 && <p className="mt-1 text-xs text-terra-600">{money(b.balance, true)} due</p>}
        </div>
      </button>
    </li>
  );
}


function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 font-display text-2xl leading-tight text-ink tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-xs text-ink-muted">{sub}</dd>
    </div>
  );
}
