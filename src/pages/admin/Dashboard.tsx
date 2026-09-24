import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { AlertCircle, ArrowRight, BedDouble, LogIn, LogOut, TrendingUp, Users, Wallet } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { isoDate, money, plural, stayRange } from "../../lib/format";
import type { BookingSummary } from "../../lib/types";
import { Card, CardHeader, EmptyState, Spinner, StatTile, StatusBadge } from "../../components/ui";
import { IncomeExpenseChart, type MonthPoint } from "../../components/admin/Charts";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { useAllBookings } from "./Bookings";

export default function Dashboard() {
  const { data: settings } = useSettings();
  const { data: bookings, isLoading } = useAllBookings();
  const { data: units } = useUnits();
  const [openId, setOpenId] = useState<string | null>(null);

  const now = new Date();
  const today = isoDate(now);
  const monthStart = isoDate(startOfMonth(now));
  const monthEnd = isoDate(endOfMonth(now));
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

  const thisMonth = chart[chart.length - 1];
  const lastMonth = chart[chart.length - 2];

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
    const daysInMonth = Number(monthEnd.slice(8, 10));
    let nights = 0;
    list
      .filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status))
      .forEach((b) => {
        const s = b.check_in < monthStart ? monthStart : b.check_in;
        const endExclusive = isoDate(addDays(new Date(`${monthEnd}T00:00:00`), 1));
        const e = b.check_out > endExclusive ? endExclusive : b.check_out;
        nights += Math.max(0, Math.round((new Date(`${e}T00:00:00`).getTime() - new Date(`${s}T00:00:00`).getTime()) / 86_400_000));
      });
    const occupancy = activeUnits ? Math.round((nights / (activeUnits * daysInMonth)) * 100) : 0;

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
    };
  }, [bookings, units, today, monthStart, monthEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Spinner />;

  const incomeChange =
    lastMonth && lastMonth.income > 0 ? Math.round(((thisMonth.income - lastMonth.income) / lastMonth.income) * 100) : null;
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mb-6">
        <p className="eyebrow mb-1">
          {format(now, "EEEE, MMMM d")} · {settings?.resort_name}
        </p>
        <h1 className="font-display text-2xl font-medium sm:text-[28px]">{greeting}</h1>
      </div>

      {(stats.pending.length > 0 || stats.departures.length > 0 || stats.arrivingToday.length > 0) && (
        <div className="mb-4 space-y-2">
          {stats.pending.length > 0 && (
            <Alert to="/admin/bookings?view=action">
              {plural(stats.pending.length, "booking request")} waiting for you to confirm
            </Alert>
          )}
          {stats.arrivingToday.length > 0 && (
            <Alert to="/admin/bookings?view=upcoming" icon={<LogIn className="size-4" />}>
              {plural(stats.arrivingToday.length, "guest")} due to check in today
            </Alert>
          )}
          {stats.departures.length > 0 && (
            <Alert to="/admin/bookings?view=inhouse" icon={<LogOut className="size-4" />}>
              {plural(stats.departures.length, "guest")} due to check out
            </Alert>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label={`Income · ${format(now, "MMM")}`}
          icon={<TrendingUp />}
          value={money(thisMonth?.income ?? 0, true)}
          sub={incomeChange != null ? `${incomeChange >= 0 ? "+" : ""}${incomeChange}% vs last month` : undefined}
        />
        <StatTile
          label="Occupancy"
          icon={<BedDouble />}
          value={`${stats.occupancy}%`}
          sub={`${plural(stats.nights, "night")} sold this month`}
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
            title="Arriving in the next 7 days"
            action={
              <Link to="/admin/calendar" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
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
              <Link to="/admin/finance" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
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

function Alert({ to, children, icon }: { to: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-level-1 transition-colors hover:bg-amber-100"
    >
      {icon ?? <AlertCircle className="size-4" />}
      <span className="flex-1">{children}</span>
      <ArrowRight className="size-4" />
    </Link>
  );
}
