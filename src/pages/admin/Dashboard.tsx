import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfMonth, subMonths } from "date-fns";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  LogIn,
  LogOut,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { isoDate, money, plural, stayRange } from "../../lib/format";
import type { BookingSummary } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Card, CardHeader, EmptyState, Spinner, StatTile, StatusBadge } from "../../components/ui";
import { IncomeExpenseChart, type MonthPoint } from "../../components/admin/Charts";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { useAllBookings } from "./Bookings";
import { useInboxUnread } from "../../lib/admin-badges";
import { useAdminRange } from "../../lib/admin-range";

/**
 * The Dashboard reads top to bottom, most urgent first:
 *   1. the day in one sentence
 *   2. what needs you: overdue, then today, then soon
 *   3. today at the resort
 *   4. how the chosen dates are going (KPIs)
 *   5. what's coming up, and the trend
 */

type Level = "overdue" | "today" | "soon";
const LEVEL_RANK: Record<Level, number> = { overdue: 0, today: 1, soon: 2 };
const LEVEL_STYLE: Record<Level, { chip: string; dot: string; label: string }> = {
  overdue: { chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500", label: "Overdue" },
  today: { chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500", label: "Today" },
  soon: { chip: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500", label: "Soon" },
};

interface Task {
  key: string;
  level: Level;
  /** For ordering within a level: earliest first. */
  date: string;
  title: string;
  detail: string;
  action: string;
  bookingId?: string;
  to?: string;
}

const SHOW_TASKS = 6;

export default function Dashboard() {
  const { data: settings } = useSettings();
  const { data: bookings, isLoading } = useAllBookings();
  const { data: units } = useUnits();
  const [openId, setOpenId] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState(false);
  const { data: unreadMessages = 0 } = useInboxUnread();

  const now = new Date();
  const today = isoDate(now);
  const range = useAdminRange();
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

  const { data: reviewsWaiting = 0 } = useQuery({
    queryKey: ["reviews", "pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending");
      return error ? 0 : (count ?? 0);
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

  const s = useMemo(() => {
    const list = bookings ?? [];
    const in3 = isoDate(addDays(now, 3));
    const in7 = isoDate(addDays(now, 7));
    const first = (b: BookingSummary) => b.guest_name.split(" ")[0];
    const due = (b: BookingSummary) => (b.balance > 0.009 ? ` · ${money(b.balance, true)} due` : "");

    // ── What needs you, most urgent first ──
    const tasks: Task[] = [];
    for (const b of list) {
      const base = { bookingId: b.id };
      if (b.status === "pending") {
        tasks.push({
          ...base,
          key: `req${b.id}`,
          level: b.check_in <= today ? "overdue" : "today",
          date: b.check_in,
          title: `Confirm or decline ${first(b)}'s request`,
          detail: `${stayRange(b.check_in, b.check_out)} · ${plural(b.guests_count, "guest")} · ${money(b.total, true)}`,
          action: "Review",
        });
      } else if (b.status === "confirmed" && b.check_in < today) {
        tasks.push({
          ...base,
          key: `noshow${b.id}`,
          level: "overdue",
          date: b.check_in,
          title: `${b.guest_name} hasn't been checked in`,
          detail: `Was due ${when(b.check_in, today)}${due(b)}`,
          action: "Check in",
        });
      } else if (b.status === "confirmed" && b.check_in === today) {
        tasks.push({
          ...base,
          key: `in${b.id}`,
          level: "today",
          date: b.check_in,
          title: `${b.guest_name} arrives today`,
          detail: `${plural(b.guests_count, "guest")} · until ${when(b.check_out, today)}${due(b)}`,
          action: "Check in",
        });
      } else if (b.status === "confirmed" && b.check_in <= in3 && b.balance > 0.009) {
        tasks.push({
          ...base,
          key: `collect${b.id}`,
          level: "soon",
          date: b.check_in,
          title: `Collect ${money(b.balance, true)} from ${b.guest_name}`,
          detail: `Arrives ${when(b.check_in, today)}`,
          action: "Open",
        });
      } else if (b.status === "checked_in" && b.check_out < today) {
        tasks.push({
          ...base,
          key: `out${b.id}`,
          level: "overdue",
          date: b.check_out,
          title: `Check ${b.guest_name} out`,
          detail: `Was due ${when(b.check_out, today)}${due(b)}`,
          action: "Check out",
        });
      } else if (b.status === "checked_in" && b.check_out === today) {
        tasks.push({
          ...base,
          key: `out${b.id}`,
          level: "today",
          date: b.check_out,
          title: `${b.guest_name} checks out today`,
          detail: `In house since ${when(b.check_in, today)}${due(b)}`,
          action: "Check out",
        });
      } else if (b.status === "checked_in" && b.balance > 0.009) {
        tasks.push({
          ...base,
          key: `collect${b.id}`,
          level: "soon",
          date: b.check_out,
          title: `Collect ${money(b.balance, true)} from ${b.guest_name}`,
          detail: `In house, leaves ${when(b.check_out, today)}`,
          action: "Open",
        });
      }
    }
    // Guests who already left without paying in full: one line, not one each.
    const owedPast = list.filter((b) => b.status === "checked_out" && b.balance > 0.009);
    if (owedPast.length) {
      const total = owedPast.reduce((t, b) => t + b.balance, 0);
      tasks.push({
        key: "owed-past",
        level: "overdue",
        date: owedPast.map((b) => b.check_out).sort()[0],
        title: `${money(total, true)} still owed from past stays`,
        detail: owedPast.length === 1 ? `${owedPast[0].guest_name} · ${owedPast[0].ref}` : `${plural(owedPast.length, "booking")} · see Finance › Unpaid`,
        action: "View",
        ...(owedPast.length === 1 ? { bookingId: owedPast[0].id } : { to: "/admin/finance" }),
      });
    }
    if (unreadMessages > 0)
      tasks.push({
        key: "messages",
        level: "today",
        date: today,
        title: `${plural(unreadMessages, "conversation")} waiting for a reply`,
        detail: "Guests messaging from the website",
        action: "Reply",
        to: "/admin/inbox",
      });
    if (reviewsWaiting > 0)
      tasks.push({
        key: "reviews",
        level: "soon",
        date: "9999",
        title: `${plural(reviewsWaiting, "review")} to publish`,
        detail: "Nothing shows on the website until you publish it",
        action: "Review",
        to: "/admin/reviews",
      });
    tasks.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.date.localeCompare(b.date));

    // ── Today at the resort ──
    const inHouse = list.filter((b) => b.status === "checked_in");
    const arrivingToday = list.filter((b) => b.status === "confirmed" && b.check_in === today);
    const leavingToday = list.filter((b) => b.status === "checked_in" && b.check_out === today);
    const upcoming = list
      .filter((b) => (b.status === "confirmed" || b.status === "pending") && b.check_in > today && b.check_in <= in7)
      .sort((a, b) => a.check_in.localeCompare(b.check_in));
    const next = list
      .filter((b) => b.status === "confirmed" && b.check_in > today)
      .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];

    // ── The chosen dates ──
    const unpaid = list.filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status) && b.balance > 0.009);
    const activeUnits = (units ?? []).filter((u) => u.is_active).length;
    let nights = 0;
    let revenue = 0;
    const endExclusive = isoDate(addDays(new Date(`${range.to}T00:00:00`), 1));
    list
      .filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status))
      .forEach((b) => {
        const st = b.check_in < range.from ? range.from : b.check_in;
        const en = b.check_out > endExclusive ? endExclusive : b.check_out;
        const n = Math.max(0, Math.round((new Date(`${en}T00:00:00`).getTime() - new Date(`${st}T00:00:00`).getTime()) / 86_400_000));
        nights += n;
        if (b.nights > 0) revenue += (b.total * n) / b.nights;
      });
    const occupancy = activeUnits ? Math.round((nights / (activeUnits * range.days)) * 100) : 0;
    const made = list.filter(
      (b) => b.created_at.slice(0, 10) >= range.from && b.created_at.slice(0, 10) <= range.to && !["cancelled", "declined"].includes(b.status),
    );

    return {
      tasks,
      inHouse,
      arrivingToday,
      leavingToday,
      upcoming,
      next,
      unpaid,
      unpaidTotal: unpaid.reduce((t, b) => t + b.balance, 0),
      occupancy,
      nights,
      adr: nights ? revenue / nights : 0,
      made,
      madeValue: made.reduce((t, b) => t + b.total, 0),
    };
  }, [bookings, units, today, range.from, range.to, range.days, unreadMessages, reviewsWaiting]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Spinner />;

  const income = rangeMoney?.now ?? 0;
  const incomeChange =
    rangeMoney && rangeMoney.before > 0 ? Math.round(((rangeMoney.now - rangeMoney.before) / rangeMoney.before) * 100) : null;
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const overdue = s.tasks.filter((t) => t.level === "overdue").length;
  const guestsIn = s.inHouse.reduce((t, b) => t + b.guests_count, 0);
  const tasks = allTasks ? s.tasks : s.tasks.slice(0, SHOW_TASKS);

  // The day in one sentence.
  const gist: string[] = [];
  if (s.tasks.length === 0) gist.push("All clear: nothing needs you right now.");
  else gist.push(`${plural(s.tasks.length, "thing")} ${s.tasks.length === 1 ? "needs" : "need"} you${overdue ? `, ${overdue} overdue` : ""}.`);
  gist.push(
    s.inHouse.length
      ? `${plural(guestsIn, "guest")} in house.`
      : s.next
        ? `The resort is empty until ${when(s.next.check_in, today)}.`
        : "No upcoming stays booked.",
  );

  return (
    <>
      {/* 1 · The day in one sentence */}
      <div className="mb-6">
        <p className="eyebrow mb-1">
          {format(now, "EEEE, MMMM d")} · {settings?.resort_name}
        </p>
        <h1 className="font-display text-2xl font-medium sm:text-[28px]">{greeting}</h1>
        <p className={cn("mt-1 text-sm", overdue ? "text-red-700" : "text-ink-soft")}>{gist.join(" ")}</p>
      </div>

      {/* 2 · Needs your attention */}
      <Section title="Needs your attention" hint="Most urgent first">
        <Card className="overflow-hidden">
          {s.tasks.length === 0 ? (
            <EmptyState icon={<CheckCircle2 />} title="You're all caught up">
              No requests, arrivals, check-outs or balances waiting.
            </EmptyState>
          ) : (
            <>
              <ul className="divide-y divide-sand-200/80">
                {tasks.map((t) => (
                  <TaskRow key={t.key} t={t} onOpen={() => t.bookingId && setOpenId(t.bookingId)} />
                ))}
              </ul>
              {s.tasks.length > SHOW_TASKS && (
                <button
                  type="button"
                  onClick={() => setAllTasks((v) => !v)}
                  className="w-full cursor-pointer border-t border-sand-200 px-5 py-2.5 text-sm font-medium text-brand-700 hover:bg-sand-50"
                >
                  {allTasks ? "Show fewer" : `Show all ${s.tasks.length}`}
                </button>
              )}
            </>
          )}
        </Card>
      </Section>

      {/* 3 · Today at the resort */}
      <Section title="Today at the resort">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile
            label="In house"
            icon={<Users />}
            value={String(guestsIn)}
            sub={s.inHouse.length ? `${plural(guestsIn, "guest")} · ${plural(s.inHouse.length, "booking")}` : "Nobody staying"}
          />
          <StatTile
            label="Arriving today"
            icon={<LogIn />}
            value={String(s.arrivingToday.length)}
            sub={s.arrivingToday.length ? s.arrivingToday.map((b) => b.guest_name.split(" ")[0]).join(", ") : "No arrivals"}
          />
          <StatTile
            label="Checking out"
            icon={<LogOut />}
            value={String(s.leavingToday.length)}
            sub={s.leavingToday.length ? s.leavingToday.map((b) => b.guest_name.split(" ")[0]).join(", ") : "No check-outs"}
          />
          <StatTile
            label="Next arrival"
            icon={<CalendarCheck />}
            value={s.next ? cap(when(s.next.check_in, today)) : "—"}
            sub={s.next ? `${s.next.guest_name} · ${plural(s.next.guests_count, "guest")}` : "Nothing booked yet"}
          />
        </div>
      </Section>

      {/* 4 · How the chosen dates are going */}
      <Section title={`${range.name} at a glance`} hint={`${range.label} · change the dates in the top bar`}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile
            label="Income"
            icon={incomeChange != null && incomeChange < 0 ? <TrendingDown /> : <TrendingUp />}
            value={money(income, true)}
            sub={incomeChange != null ? `${incomeChange >= 0 ? "▲" : "▼"} ${Math.abs(incomeChange)}% vs the ${range.days} days before` : "Money received"}
          />
          <StatTile
            label="Occupancy"
            icon={<BedDouble />}
            value={`${s.occupancy}%`}
            sub={s.nights ? `${plural(s.nights, "night")} sold · ${money(s.adr, true)} avg/night` : "No nights sold"}
          />
          <StatTile
            label="New bookings"
            icon={<CalendarCheck />}
            value={String(s.made.length)}
            sub={s.made.length ? `${money(s.madeValue, true)} booked` : "None made in these dates"}
          />
          <Link to="/admin/finance" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-700">
            <StatTile
              label="Unpaid balances"
              icon={<Wallet />}
              tone={s.unpaidTotal > 0 ? "warn" : "default"}
              value={money(s.unpaidTotal, true)}
              sub={s.unpaid.length ? `${plural(s.unpaid.length, "booking")} · all dates` : "Everyone's paid up"}
            />
          </Link>
        </div>
      </Section>

      {/* 5 · Coming up, and the trend */}
      <Section title="Coming up">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader
              title="Next 7 days"
              description={s.upcoming.length ? plural(s.upcoming.length, "arrival") : undefined}
              action={
                <Link to="/admin/calendar" className="link-action inline-flex items-center gap-1 text-xs">
                  Calendar <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            {s.upcoming.length === 0 ? (
              <EmptyState title="No arrivals this week" />
            ) : (
              <ul className="divide-y divide-sand-200/80">
                {s.upcoming.map((b) => (
                  <ArrivalRow key={b.id} b={b} today={today} onOpen={() => setOpenId(b.id)} />
                ))}
              </ul>
            )}
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader
              title="Last 6 months"
              description="Income and expenses"
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
      </Section>

      <BookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

/** "Today", "Tomorrow", "Yesterday", or "Mon, Nov 24". */
function when(iso: string, today: string) {
  const t = new Date(`${today}T00:00:00`);
  if (iso === today) return "today";
  if (iso === isoDate(addDays(t, 1))) return "tomorrow";
  if (iso === isoDate(addDays(t, -1))) return "yesterday";
  return format(new Date(`${iso}T00:00:00`), "EEE, MMM d");
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function TaskRow({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const st = LEVEL_STYLE[t.level];
  const inner = (
    <>
      <span className={cn("size-2 shrink-0 rounded-full", st.dot)} aria-hidden />
      <span
        className={cn(
          "hidden w-[68px] shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset sm:inline-flex",
          st.chip,
        )}
      >
        {st.label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{t.title}</span>
        <span className="block truncate text-xs text-ink-muted">
          <span className="sm:hidden">{st.label} · </span>
          {t.detail}
        </span>
      </span>
      <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-sand-300 bg-white px-3 text-sm font-medium text-ink shadow-[0_1px_0_var(--color-sand-300)] group-hover:bg-sand-100">
        {t.action}
        <ChevronRight className="size-3.5 text-ink-muted" />
      </span>
    </>
  );
  const cls = "group flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left hover:bg-sand-50";
  return (
    <li>
      {t.to ? (
        <Link to={t.to} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}

function ArrivalRow({ b, today, onOpen }: { b: BookingSummary; today: string; onOpen: () => void }) {
  const w = when(b.check_in, today);
  return (
    <li>
      <button onClick={onOpen} className="flex w-full cursor-pointer items-center gap-4 px-5 py-3 text-left hover:bg-sand-50">
        <div className="w-24 shrink-0 text-sm font-medium text-brand-700 first-letter:uppercase">{w}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{b.guest_name}</p>
          <p className="truncate text-xs text-ink-muted">
            {stayRange(b.check_in, b.check_out)} · {plural(b.guests_count, "guest")}
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

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
