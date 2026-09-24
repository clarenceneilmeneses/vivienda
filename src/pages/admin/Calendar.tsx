import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  parseISO,
  startOfMonth,
} from "date-fns";
import { toast } from "sonner";
import { Ban, BedDouble, ChevronLeft, ChevronRight, Plus, Tag } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { nightlyRate, useBookingsInRange, useUnits } from "../../lib/queries";
import { compactMoney, isoDate, money } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { BookingStatus, BookingSummary, Unit } from "../../lib/types";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner } from "../../components/ui";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { BookingForm } from "../../components/admin/BookingForm";

const BAR: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900 ring-amber-300",
  confirmed: "bg-forest-600 text-white ring-forest-700",
  checked_in: "bg-sky-600 text-white ring-sky-700",
  checked_out: "bg-sand-300 text-ink-soft ring-sand-300",
  cancelled: "hidden",
  declined: "hidden",
};

const LEGEND: { label: string; className: string }[] = [
  { label: "Pending", className: "bg-amber-100 ring-1 ring-amber-300" },
  { label: "Confirmed", className: "bg-forest-600" },
  { label: "Checked in", className: "bg-sky-600" },
  { label: "Checked out", className: "bg-sand-300" },
  { label: "Blocked", className: "hatch bg-sand-100 ring-1 ring-sand-300" },
];

interface Cell {
  unit: Unit;
  date: string;
}

export default function Calendar() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [cell, setCell] = useState<Cell | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const [newBooking, setNewBooking] = useState<{ unitId: string; checkIn: string } | null>(null);

  const days = eachDayOfInterval({ start: month, end: endOfMonth(month) });
  const from = isoDate(month);
  const to = isoDate(endOfMonth(month));
  const today = isoDate(new Date());

  const { data: units, isLoading } = useUnits();
  const { data: bookings } = useBookingsInRange(from, to);
  const scroller = useRef<HTMLDivElement>(null);

  // Open on today rather than the 1st, so this week is always in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const idx = today >= from && today <= to ? Number(today.slice(8, 10)) - 2 : 0;
    el.scrollLeft = Math.max(0, idx) * 48;
  }, [from, to, today, isLoading, units?.length]);
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
    () => (bookings ?? []).filter((b) => b.status !== "cancelled" && b.status !== "declined"),
    [bookings],
  );

  const occupancy = useMemo(() => {
    if (!units?.length) return 0;
    const active = units.filter((u) => u.is_active);
    let booked = 0;
    for (const b of live) {
      if (b.status === "pending") continue;
      const s = b.check_in < from ? from : b.check_in;
      const e = b.check_out > isoDate(addDays(parseISO(to), 1)) ? isoDate(addDays(parseISO(to), 1)) : b.check_out;
      booked += Math.max(0, (parseISO(e).getTime() - parseISO(s).getTime()) / 86_400_000);
    }
    return active.length ? Math.round((booked / (active.length * days.length)) * 100) : 0;
  }, [live, units, from, to, days.length]);

  if (isLoading) return <Spinner />;

  const colWidth = 48;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Click a day to block it, change its price, or add a booking."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-36 text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</span>
            <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      {!units?.length ? (
        <Card>
          <EmptyState icon={<BedDouble className="size-8" />} title="Add a room first">
            Rooms and their rates are set up under Rooms & rates.
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-4 py-3">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
              {LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span className={cn("inline-block size-3 rounded-sm", l.className)} />
                  {l.label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-muted">
              Occupancy this month: <span className="font-semibold text-ink">{occupancy}%</span>
            </p>
          </div>
          <div ref={scroller} className="overflow-x-auto">
            <div style={{ minWidth: 160 + days.length * colWidth }}>
              <div
                className="grid border-b border-sand-200 text-center text-xs"
                style={{ gridTemplateColumns: `160px repeat(${days.length}, minmax(${colWidth}px, 1fr))` }}
              >
                <div className="sticky left-0 z-10 bg-white" />
                {days.map((d) => {
                  const iso = isoDate(d);
                  return (
                    <div
                      key={iso}
                      className={cn(
                        "py-2",
                        isWeekend(d) && "bg-sand-50",
                        iso === today && "bg-clay-50 font-semibold text-clay-600",
                      )}
                    >
                      <div className="text-[10px] text-ink-muted uppercase">{format(d, "EEEEE")}</div>
                      <div>{format(d, "d")}</div>
                    </div>
                  );
                })}
              </div>

              {units.map((u) => {
                const unitBookings = live.filter((b) => b.unit_id === u.id);
                const rates = extras?.rates.get(u.id);
                return (
                  <div
                    key={u.id}
                    className="grid border-b border-sand-200 last:border-b-0"
                    style={{ gridTemplateColumns: `160px repeat(${days.length}, minmax(${colWidth}px, 1fr))` }}
                  >
                    <div
                      className="sticky left-0 z-10 flex flex-col justify-center border-r border-sand-200 bg-white px-3 py-2"
                      style={{ gridRow: 1, gridColumn: 1 }}
                    >
                      <p className={cn("truncate text-sm font-medium", !u.is_active && "text-ink-muted")}>{u.name}</p>
                      <p className="text-xs text-ink-muted">{money(u.base_rate, true)}</p>
                    </div>
                    {days.map((d, i) => {
                      const iso = isoDate(d);
                      const blocked = extras?.blocked.has(`${u.id}|${iso}`);
                      const override = rates?.has(iso);
                      return (
                        <button
                          key={iso}
                          style={{ gridRow: 1, gridColumn: i + 2 }}
                          onClick={() => setCell({ unit: u, date: iso })}
                          className={cn(
                            "flex h-16 flex-col items-center justify-end border-r border-sand-100 pb-1 text-[10px] hover:bg-forest-50",
                            isWeekend(d) && "bg-sand-50",
                            blocked && "hatch bg-sand-100",
                          )}
                          aria-label={`${u.name}, ${format(d, "MMMM d")}${blocked ? ", blocked" : ""}`}
                        >
                          <span className={cn("tabular-nums", override ? "font-semibold text-clay-600" : "text-ink-muted")}>
                            {compactMoney(nightlyRate(u, iso, rates))}
                          </span>
                        </button>
                      );
                    })}
                    {unitBookings.map((b) => (
                      <BookingBar key={b.id} booking={b} from={from} to={to} onOpen={() => setOpenBooking(b.id)} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {cell && (
        <CellModal
          cell={cell}
          booking={live.find((b) => b.unit_id === cell.unit.id && b.check_in <= cell.date && b.check_out > cell.date)}
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

function BookingBar({
  booking: b,
  from,
  to,
  onOpen,
}: {
  booking: BookingSummary;
  from: string;
  to: string;
  onOpen: () => void;
}) {
  const monthStart = parseISO(from);
  const lastNight = b.check_out > to ? to : isoDate(addDays(parseISO(b.check_out), -1));
  const first = b.check_in < from ? from : b.check_in;
  const startCol = Math.round((parseISO(first).getTime() - monthStart.getTime()) / 86_400_000) + 2;
  const span = Math.round((parseISO(lastNight).getTime() - parseISO(first).getTime()) / 86_400_000) + 1;
  const continuesLeft = b.check_in < from;
  const continuesRight = b.check_out > isoDate(addDays(parseISO(to), 1));
  return (
    <button
      onClick={onOpen}
      style={{ gridRow: 1, gridColumn: `${startCol} / span ${span}` }}
      className={cn(
        "z-[5] mx-0.5 mt-2 mb-6 flex items-center overflow-hidden px-2 text-left text-xs font-medium ring-1 ring-inset",
        continuesLeft ? "rounded-l-none" : "rounded-l-md",
        continuesRight ? "rounded-r-none" : "rounded-r-md",
        BAR[b.status],
      )}
      title={`${b.guest_name} · ${b.ref}`}
    >
      <span className="truncate">{b.guest_name}</span>
    </button>
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
            <Tag className="size-4 text-clay-500" /> Price per night
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
            <Ban className="size-4 text-clay-500" /> {blocked ? "Blocked" : "Block dates"}
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
