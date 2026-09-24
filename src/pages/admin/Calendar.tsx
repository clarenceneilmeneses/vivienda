import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toast } from "sonner";
import { Ban, BedDouble, ChevronLeft, ChevronRight, LogIn, LogOut, Plus, Tag } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { nightlyRate, useBookingsInRange, useSettings, useUnits } from "../../lib/queries";
import { compactMoney, isoDate, money, prettyTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import { STATUS_LABEL, type BookingStatus, type BookingSummary, type Unit } from "../../lib/types";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, StatusBadge } from "../../components/ui";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { BookingForm } from "../../components/admin/BookingForm";

const CHIP: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300",
  confirmed: "bg-brand-700 text-sand-50",
  checked_in: "bg-sky-600 text-white",
  checked_out: "bg-sand-200 text-ink-soft",
  cancelled: "hidden",
  declined: "hidden",
};

const LEGEND: { label: string; className: string }[] = [
  { label: "Pending", className: "bg-amber-100 ring-1 ring-amber-300" },
  { label: "Confirmed", className: "bg-brand-700" },
  { label: "Checked in", className: "bg-sky-600" },
  { label: "Checked out", className: "bg-sand-200" },
  { label: "Blocked", className: "hatch bg-sand-100 ring-1 ring-sand-300" },
  { label: "Special price", className: "bg-terra-50 ring-1 ring-terra-500/40" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Cell {
  unit: Unit;
  date: string;
}

export default function Calendar() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [unitId, setUnitId] = useState<string | null>(null);
  const [cell, setCell] = useState<Cell | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const [newBooking, setNewBooking] = useState<{ unitId: string; checkIn: string } | null>(null);

  const from = isoDate(month);
  const to = isoDate(endOfMonth(month));
  const today = isoDate(new Date());
  // Whole weeks, Sunday to Saturday, so the grid is a real month view.
  const gridDays = eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) });
  const daysInMonth = Number(to.slice(8, 10));

  const { data: units, isLoading } = useUnits();
  const { data: settings } = useSettings();
  const checkOutTime = settings?.check_out_time ?? "12:00";
  const { data: bookings } = useBookingsInRange(from, to);
  // Vivienda is one resort; the picker only appears if more listings are ever added.
  const unit = units?.find((u) => u.id === unitId) ?? units?.find((u) => u.is_active) ?? units?.[0];

  const { data: extras } = useQuery({
    queryKey: ["calendar-extras", from, to],
    queryFn: async () => {
      const [blocked, rates] = await Promise.all([
        supabase.from("blocked_dates").select("unit_id, date, reason").gte("date", from).lte("date", to),
        supabase.from("rate_overrides").select("unit_id, date, rate").gte("date", from).lte("date", to),
      ]);
      if (blocked.error) throw blocked.error;
      if (rates.error) throw rates.error;
      const blockedMap = new Map<string, string>();
      blocked.data.forEach((b) => blockedMap.set(`${b.unit_id}|${b.date}`, b.reason ?? ""));
      const rateMap = new Map<string, Map<string, number>>();
      rates.data.forEach((r) => {
        if (!rateMap.has(r.unit_id)) rateMap.set(r.unit_id, new Map());
        rateMap.get(r.unit_id)!.set(r.date, Number(r.rate));
      });
      return { blocked: blockedMap, rates: rateMap };
    },
  });

  const live = useMemo(
    () =>
      (bookings ?? []).filter((b) => b.unit_id === unit?.id && b.status !== "cancelled" && b.status !== "declined"),
    [bookings, unit?.id],
  );
  const rates = unit ? extras?.rates.get(unit.id) : undefined;

  const summary = useMemo(() => {
    const monthEndExclusive = isoDate(addDays(parseISO(to), 1));
    let nights = 0;
    let guests = 0;
    let value = 0;
    for (const b of live) {
      if (b.status === "pending") continue;
      const s0 = b.check_in < from ? from : b.check_in;
      const e0 = b.check_out > monthEndExclusive ? monthEndExclusive : b.check_out;
      nights += Math.max(0, Math.round((parseISO(e0).getTime() - parseISO(s0).getTime()) / 86_400_000));
      if (b.check_in >= from && b.check_in <= to) {
        guests += b.guests_count;
        value += b.total;
      }
    }
    const blockedDays = unit ? [...(extras?.blocked.keys() ?? [])].filter((k) => k.startsWith(`${unit.id}|`)).length : 0;
    return {
      nights,
      guests,
      value,
      blockedDays,
      pending: live.filter((b) => b.status === "pending").length,
      occupancy: Math.round((nights / daysInMonth) * 100),
      list: [...live].filter((b) => b.check_in <= to && b.check_out > from).sort((a, b) => a.check_in.localeCompare(b.check_in)),
    };
  }, [live, from, to, daysInMonth, extras, unit]);

  if (isLoading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Click a day to add a booking, block it, or give it a special price."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {units && units.length > 1 && (
              <select
                value={unit?.id}
                onChange={(e) => setUnitId(e.target.value)}
                className="h-8 rounded-xl border border-sand-300 bg-white px-2 text-sm"
                aria-label="Listing"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="secondary" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="w-36 text-center font-display text-base font-medium">{format(month, "MMMM yyyy")}</span>
              <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        }
      />

      {!unit ? (
        <Card>
          <EmptyState icon={<BedDouble className="size-8" />} title="Add the resort first">
            The resort and its rates are set up under Rooms & rates.
          </EmptyState>
        </Card>
      ) : (
        <>
        <Card className="mb-4 flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
          <div className="lg:w-64 lg:shrink-0">
            <p className="eyebrow">{format(month, "MMMM")} at a glance</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-display text-4xl leading-none text-ink">{summary.occupancy}%</span>
              <span className="pb-1 text-sm text-ink-muted">occupied</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand-100">
              <div className="h-full rounded-full bg-brand-700" style={{ width: `${Math.min(100, summary.occupancy)}%` }} />
            </div>
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Nights booked" value={`${summary.nights} / ${daysInMonth}`} />
            <Stat label="Guests arriving" value={String(summary.guests)} />
            <Stat label="Booked value" value={money(summary.value, true)} />
            <Stat label="Blocked days" value={String(summary.blockedDays)} />
          </dl>
          {summary.pending > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 lg:w-40">
              {summary.pending} request{summary.pending === 1 ? "" : "s"} waiting for you to confirm
            </p>
          )}
        </Card>
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="overflow-hidden">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-sand-200/80 px-4 py-3 text-xs text-ink-soft">
              {LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span className={cn("inline-block size-3 rounded-sm", l.className)} />
                  {l.label}
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-7 border-b border-sand-200/80 bg-sand-50 text-center text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-2">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {gridDays.map((d) => {
                    const iso = isoDate(d);
                    const inMonth = iso >= from && iso <= to;
                    if (!inMonth) {
                      return (
                        <div key={iso} className="min-h-36 border-r border-b border-sand-100 bg-sand-50/60 p-2 text-sm text-ink-muted/50 [&:nth-child(7n)]:border-r-0">
                          {format(d, "d")}
                        </div>
                      );
                    }
                    const staying = live.find((b) => b.check_in <= iso && b.check_out > iso);
                    const leaving = live.find((b) => b.check_out === iso);
                    const blockedReason = extras?.blocked.get(`${unit.id}|${iso}`);
                    const blocked = blockedReason !== undefined;
                    const override = rates?.has(iso);
                    const past = iso < today;
                    return (
                      <div
                        key={iso}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCell({ unit, date: iso })}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setCell({ unit, date: iso })}
                        aria-label={`${format(d, "EEEE, MMMM d")}${staying ? `, booked by ${staying.guest_name}` : ""}${blocked ? ", blocked" : ""}`}
                        className={cn(
                          "group flex min-h-36 cursor-pointer flex-col gap-1.5 border-r border-b border-sand-100 p-2 text-left transition-colors outline-none hover:bg-brand-50/60 focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-inset [&:nth-child(7n)]:border-r-0",
                          isWeekend(d) && "bg-sand-50/70",
                          blocked && "hatch bg-sand-100",
                          override && !blocked && "bg-terra-50/70",
                          past && "opacity-60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "grid size-7 place-items-center rounded-full text-sm tabular-nums",
                              iso === today ? "bg-brand-700 font-semibold text-sand-50" : "text-ink",
                            )}
                          >
                            {format(d, "d")}
                          </span>
                          {!staying && !blocked && (
                            <span className={cn("text-[11px] tabular-nums", override ? "font-semibold text-terra-600" : "text-ink-muted")}>
                              {compactMoney(nightlyRate(unit, iso, rates))}
                            </span>
                          )}
                        </div>

                        {leaving && leaving.id !== staying?.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenBooking(leaving.id);
                            }}
                            className="flex items-center gap-1 truncate text-left text-[11px] text-ink-muted hover:text-ink"
                          >
                            <LogOut className="size-3 shrink-0" /> Out by {prettyTime(checkOutTime)} · {leaving.guest_name}
                          </button>
                        )}

                        {staying && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenBooking(staying.id);
                            }}
                            className={cn("mt-auto w-full rounded-lg px-2 py-1.5 text-left text-xs shadow-level-1", CHIP[staying.status])}
                            title={`${staying.guest_name} · ${staying.ref}`}
                          >
                            <span className="block truncate font-semibold">
                              {staying.check_in === iso && <LogIn className="mr-1 inline size-3 align-[-2px]" />}
                              {staying.guest_name}
                            </span>
                            <span className="block truncate opacity-80">
                              {staying.guests_count} pax · {STATUS_LABEL[staying.status]}
                              {staying.balance > 0.009 && ` · ${compactMoney(staying.balance)} due`}
                            </span>
                          </button>
                        )}

                        {blocked && !staying && (
                          <span className="mt-auto flex items-center gap-1 truncate rounded-md bg-white/80 px-1.5 py-1 text-[11px] font-medium text-ink-soft">
                            <Ban className="size-3 shrink-0" /> {blockedReason || "Blocked"}
                          </span>
                        )}

                        {!staying && !blocked && !past && (
                          <span className="mt-auto hidden items-center gap-1 text-[11px] font-medium text-brand-700 group-hover:flex">
                            <Plus className="size-3" /> Add booking
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          <div>
            <Card>
              <p className="border-b border-sand-200/80 px-5 py-3 font-display text-base font-medium">Stays this month</p>
              {summary.list.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-muted">No bookings yet.</p>
              ) : (
                <ul className="max-h-[520px] divide-y divide-sand-200/70 overflow-y-auto">
                  {summary.list.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => setOpenBooking(b.id)}
                        className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left hover:bg-sand-50"
                      >
                        <span className="w-11 shrink-0 text-center leading-tight">
                          <span className="block text-[10px] font-semibold text-ink-muted uppercase">{format(parseISO(b.check_in), "MMM")}</span>
                          <span className="block font-display text-lg text-brand-700">{format(parseISO(b.check_in), "d")}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{b.guest_name}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            {b.nights} night{b.nights === 1 ? "" : "s"} · {b.guests_count} pax
                          </span>
                        </span>
                        <StatusBadge status={b.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
        </>
      )}

      {cell && (
        <CellModal
          cell={cell}
          booking={live.find((b) => b.check_in <= cell.date && b.check_out > cell.date)}
          blockedReason={extras?.blocked.get(`${cell.unit.id}|${cell.date}`)}
          override={extras?.rates.get(cell.unit.id)?.get(cell.date)}
          onClose={() => setCell(null)}
          onOpenBooking={(id) => {
            setCell(null);
            setOpenBooking(id);
          }}
          onNewBooking={() => {
            setNewBooking({ unitId: cell.unit.id, checkIn: cell.date });
            setCell(null);
          }}
          onChanged={() => qc.invalidateQueries()}
        />
      )}
      <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />
      <BookingForm
        open={Boolean(newBooking)}
        onClose={() => setNewBooking(null)}
        preset={newBooking ?? undefined}
        onSaved={(id) => setOpenBooking(id)}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sand-100/70 px-3 py-2">
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CellModal({
  cell,
  booking,
  blockedReason,
  override,
  onClose,
  onOpenBooking,
  onNewBooking,
  onChanged,
}: {
  cell: Cell;
  booking?: BookingSummary;
  blockedReason?: string;
  override?: number;
  onClose: () => void;
  onOpenBooking: (id: string) => void;
  onNewBooking: () => void;
  onChanged: () => void;
}) {
  const { unit, date } = cell;
  const blocked = blockedReason !== undefined;
  const [until, setUntil] = useState(date);
  const [reason, setReason] = useState(blockedReason ?? "");
  const [rate, setRate] = useState(override != null ? String(override) : "");
  const [busy, setBusy] = useState<string | null>(null);

  const dates = () => {
    const end = until < date ? date : until;
    return eachDayOfInterval({ start: parseISO(date), end: parseISO(end) }).map(isoDate);
  };

  async function run(key: string, fn: () => PromiseLike<{ error: unknown }>, success: string) {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(success);
    onChanged();
    onClose();
  }

  const n = dates().length;
  const label = n > 1 ? `${n} days` : "this day";

  return (
    <Modal open onClose={onClose} size="sm" title={unit.name} description={format(parseISO(date), "EEEE, MMMM d, yyyy")}>
      <div className="space-y-5">
        {booking ? (
          <div className="rounded-lg bg-sand-50 p-3 text-sm">
            <p className="font-medium">{booking.guest_name}</p>
            <p className="text-ink-muted">
              {booking.ref} · {booking.status.replace("_", " ")}
            </p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => onOpenBooking(booking.id)}>
              Open booking
            </Button>
          </div>
        ) : (
          !blocked && (
            <Button className="w-full" onClick={onNewBooking}>
              <Plus className="size-4" /> Add booking from this day
            </Button>
          )
        )}

        <Field label="Apply to" hint="Pick a later date to change several days at once.">
          {(id) => (
            <Input id={id} type="date" min={date} value={until} onChange={(e) => setUntil(e.target.value)} />
          )}
        </Field>

        <div className="space-y-2 rounded-lg border border-sand-200 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Tag className="size-4 text-brand-700" /> Price per night
          </p>
          <p className="text-xs text-ink-muted">
            Normal rate {money(nightlyRate(unit, date))}
            {override != null && ` · currently ${money(override)}`}
          </p>
          <div className="flex gap-2">
            <Input type="number" min={0} placeholder="e.g. 4500" value={rate} onChange={(e) => setRate(e.target.value)} />
            <Button
              variant="secondary"
              loading={busy === "rate"}
              disabled={rate === "" || Number(rate) < 0}
              onClick={() =>
                run(
                  "rate",
                  () =>
                    supabase
                      .from("rate_overrides")
                      .upsert(dates().map((d) => ({ unit_id: unit.id, date: d, rate: Number(rate) })), {
                        onConflict: "unit_id,date",
                      }),
                  `Price set for ${label}`,
                )
              }
            >
              Set
            </Button>
          </div>
          {override != null && (
            <button
              className="text-xs text-ink-muted underline hover:text-ink"
              onClick={() =>
                run(
                  "clear",
                  () => supabase.from("rate_overrides").delete().eq("unit_id", unit.id).in("date", dates()),
                  "Back to normal rate",
                )
              }
            >
              Reset to normal rate
            </button>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-sand-200 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Ban className="size-4 text-brand-700" /> {blocked ? "Blocked" : "Block dates"}
          </p>
          {blocked ? (
            <>
              {blockedReason && <p className="text-sm text-ink-soft">{blockedReason}</p>}
              <Button
                variant="secondary"
                size="sm"
                loading={busy === "unblock"}
                onClick={() =>
                  run(
                    "unblock",
                    () => supabase.from("blocked_dates").delete().eq("unit_id", unit.id).in("date", dates()),
                    `Opened ${label}`,
                  )
                }
              >
                Open {label} for booking
              </Button>
            </>
          ) : (
            <>
              <Input placeholder="Reason (e.g. repairs, owner's use)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button
                variant="secondary"
                size="sm"
                loading={busy === "block"}
                disabled={Boolean(booking)}
                onClick={() =>
                  run(
                    "block",
                    () =>
                      supabase
                        .from("blocked_dates")
                        .upsert(dates().map((d) => ({ unit_id: unit.id, date: d, reason: reason.trim() })), {
                          onConflict: "unit_id,date",
                        }),
                    `Blocked ${label}`,
                  )
                }
              >
                Block {label}
              </Button>
              {booking && <p className="text-xs text-ink-muted">This day is booked, so it can't be blocked.</p>}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
