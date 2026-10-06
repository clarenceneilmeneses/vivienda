import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toast } from "sonner";
import { Ban, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock3, RotateCcw, Tag, X } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { nightlyRate, useBookingsInRange, useUnits } from "../../lib/queries";
import { compactMoney, isoDate, money, plural, stayRange } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { BookingSummary, Unit } from "../../lib/types";
import { Button, EmptyState, Input, Spinner, StatusBadge } from "../../components/ui";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { BookingForm, type BookingPreset } from "../../components/admin/BookingForm";

/**
 * The resort's calendar, laid out like Airbnb's host calendar (and Malaya's):
 * one big month of day tiles with the night's price, bookings as name chips,
 * and a panel on the right. Drag across nights (or click one, then another)
 * to close them, reopen them, change their price or start a booking.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const REASONS = ["Maintenance", "Owner use", "Private event", "Other"];

interface Sel {
  start: string;
  end: string; // inclusive: the last night
}

const next = (iso: string, n = 1) => isoDate(addDays(parseISO(iso), n));

function nightsOf(sel: Sel) {
  const out: string[] = [];
  for (let d = sel.start; d <= sel.end; d = next(d)) out.push(d);
  return out;
}

/** Contiguous runs, so "close 5 nights" can say which. */
function useDragSelect(selection: Sel | null, setSelection: (s: Sel | null) => void) {
  const drag = useRef<{ anchor: string; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    const end = () => {
      if (drag.current?.moved) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
      }
      drag.current = null;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const range = (a: string, b: string): Sel => (a <= b ? { start: a, end: b } : { start: b, end: a });

  const onDown = useCallback(
    (date: string, e: PointerEvent) => {
      if (e.button !== 0) return;
      let anchor = date;
      if (selection && e.shiftKey) {
        anchor = selection.start;
        setSelection(range(selection.start, date));
      } else if (selection && selection.start === selection.end && selection.start !== date) {
        // Click one night, then another: the stretch between them.
        anchor = selection.start;
        setSelection(range(selection.start, date));
      } else if (selection && selection.start === date && selection.end === date) {
        setSelection(null);
        return;
      } else {
        setSelection({ start: date, end: date });
      }
      if (e.pointerType !== "touch") drag.current = { anchor, moved: false };
    },
    [selection, setSelection],
  );

  const onMove = useCallback(
    (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cal-date]");
      const date = el?.dataset.calDate;
      if (!date) return;
      d.moved = true;
      setSelection(range(d.anchor, date));
    },
    [setSelection],
  );

  return { onDown, onMove, consumed: () => justDragged.current };
}

export default function Calendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selection, setSelection] = useState<Sel | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const [newBooking, setNewBooking] = useState<BookingPreset | null>(null);
  const drag = useDragSelect(selection, setSelection);

  const today = isoDate(new Date());
  const gridStart = startOfWeek(month);
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd }).map(isoDate);
  const from = days[0]!;
  const to = days[days.length - 1]!;
  const monthKey = format(month, "yyyy-MM");

  const { data: units, isLoading } = useUnits();
  const unit = units?.find((u) => u.is_active) ?? units?.[0];
  const { data: bookings } = useBookingsInRange(from, to);
  const { data: extras } = useCalendarExtras(unit?.id, from, to);

  const live = useMemo(
    () => (bookings ?? []).filter((b) => b.unit_id === unit?.id && b.status !== "cancelled" && b.status !== "declined"),
    [bookings, unit?.id],
  );
  const byNight = useMemo(() => {
    const m = new Map<string, BookingSummary>();
    for (const b of live) for (let d = b.check_in; d < b.check_out; d = next(d)) m.set(d, b);
    return m;
  }, [live]);

  // Esc clears; changing month keeps nothing selected.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelection(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => setSelection(null), [monthKey]);

  if (isLoading) return <Spinner />;
  if (!unit) {
    return <EmptyState title="Add the resort first">Create the listing under Rooms &amp; rates, then come back.</EmptyState>;
  }

  const monthDays = days.filter((d) => d.startsWith(monthKey));
  const sold = monthDays.filter((d) => {
    const b = byNight.get(d);
    return b && b.status !== "pending";
  }).length;
  const value = live.filter((b) => b.check_in.startsWith(monthKey) && b.status !== "pending").reduce((s, b) => s + b.total, 0);
  const pending = live.filter((b) => b.status === "pending" && b.check_out > from && b.check_in <= to).length;

  const panel = selection ? (
    <SelectionPanel
      unit={unit}
      selection={selection}
      byNight={byNight}
      blocked={extras?.blocked ?? new Map()}
      overrides={extras?.rates ?? new Map()}
      onClear={() => setSelection(null)}
      onOpenBooking={setOpenBooking}
      onCreate={() =>
        setNewBooking({ unitId: unit.id, checkIn: selection.start, checkOut: next(selection.end), status: "confirmed" })
      }
    />
  ) : (
    <ResortPanel unit={unit} occupancy={Math.round((sold / monthDays.length) * 100)} sold={sold} value={value} pending={pending} />
  );

  return (
    <div className="lg:-mt-2">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-medium text-ink sm:text-[28px]">{format(month, "MMMM yyyy")}</h1>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, -1))}
                className="grid size-8 cursor-pointer place-items-center rounded-full border border-sand-300 hover:bg-sand-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                className="grid size-8 cursor-pointer place-items-center rounded-full border border-sand-300 hover:bg-sand-100"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div onPointerMove={drag.onMove} className="grid select-none grid-cols-7 gap-1 sm:gap-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-center text-[11px] font-medium text-ink-muted">
                <span className="sm:hidden">{w[0]}</span>
                <span className="hidden sm:inline">{w}</span>
              </div>
            ))}
            {days.map((date) => {
              const inMonth = date.startsWith(monthKey);
              const booking = byNight.get(date);
              const reason = extras?.blocked.get(date);
              const closed = reason !== undefined && !booking;
              const special = extras?.rates.has(date);
              const price = nightlyRate(unit, date, extras?.rates);
              const selected = Boolean(selection && date >= selection.start && date <= selection.end);
              const past = date < today;
              const chip = booking && (booking.check_in === date || parseISO(date).getDay() === 0);
              const first = booking?.guest_name.split(" ")[0] ?? "";
              return (
                <button
                  key={date}
                  type="button"
                  data-cal-date={date}
                  title={
                    booking
                      ? `${booking.guest_name} · ${stayRange(booking.check_in, booking.check_out)}`
                      : closed
                        ? `${reason || "Closed"} — not bookable`
                        : money(price, true)
                  }
                  onPointerDown={(e) => !booking && drag.onDown(date, e)}
                  onClick={() => {
                    if (drag.consumed()) return;
                    if (booking) setOpenBooking(booking.id);
                  }}
                  className={cn(
                    "relative flex min-h-[64px] min-w-0 cursor-pointer flex-col items-start overflow-hidden rounded-lg p-1.5 text-left transition sm:min-h-[104px] sm:rounded-xl sm:p-3",
                    selected
                      ? "bg-ink text-white"
                      : closed
                        ? "hatch bg-sand-100 text-ink-muted"
                        : "border border-sand-200 bg-white hover:border-ink/40",
                    !inMonth && !selected && "opacity-40",
                    past && inMonth && !selected && "opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold tabular-nums sm:text-sm",
                      closed && !selected && "line-through",
                      date === today && "grid size-6 place-items-center rounded-full bg-red-600 text-[11px] text-white no-underline",
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>

                  {booking ? (
                    chip ? (
                      <span
                        className={cn(
                          "mt-auto flex max-w-full items-center gap-1 rounded-full px-1 py-0.5 text-[9px] sm:px-1.5 sm:py-1 sm:text-xs",
                          booking.status === "pending"
                            ? "bg-amber-200 text-amber-950"
                            : booking.status === "checked_in"
                              ? "bg-sky-600 text-white"
                              : "bg-brand-700 text-sand-50",
                        )}
                      >
                        <span className="hidden size-5 shrink-0 place-items-center rounded-full bg-white/25 text-[10px] font-bold sm:grid">
                          {first[0]}
                        </span>
                        {booking.status === "pending" && <Clock3 className="size-3 shrink-0" />}
                        <span className="truncate font-medium">{first}</span>
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "mt-auto h-1.5 w-full rounded-full",
                          booking.status === "pending" ? "bg-amber-300" : booking.status === "checked_in" ? "bg-sky-600" : "bg-brand-700",
                        )}
                      />
                    )
                  ) : closed ? (
                    <span className="mt-auto hidden items-center gap-1 text-xs sm:flex">
                      <Ban className="size-3" /> {reason || "Closed"}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "mt-auto text-[10px] tabular-nums sm:text-sm",
                        special && !selected && "font-semibold text-terra-600",
                      )}
                    >
                      {compactMoney(price)}
                    </span>
                  )}
                  {special && !booking && !closed && (
                    <Tag className={cn("absolute top-2 right-2 hidden size-3 text-terra-500 sm:block", selected && "text-white")} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* On a phone the panel is a sheet over the bottom of the screen while nights are selected. */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 space-y-3">{panel}</div>
        </aside>
        {selection ? (
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-sand-200 bg-sand-50 p-4 pb-8 shadow-level-4 lg:hidden">
            {panel}
          </div>
        ) : (
          <div className="space-y-3 lg:hidden">{panel}</div>
        )}
      </div>

      <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />
      <BookingForm
        open={Boolean(newBooking)}
        onClose={() => setNewBooking(null)}
        preset={newBooking ?? undefined}
        onSaved={(id) => {
          setNewBooking(null);
          setSelection(null);
          setOpenBooking(id);
        }}
      />
    </div>
  );
}

function useCalendarExtras(unitId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["calendar-extras", unitId, from, to],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const [blocked, rates] = await Promise.all([
        supabase.from("blocked_dates").select("date, reason").eq("unit_id", unitId!).gte("date", from).lte("date", to),
        supabase.from("rate_overrides").select("date, rate").eq("unit_id", unitId!).gte("date", from).lte("date", to),
      ]);
      if (blocked.error) throw blocked.error;
      if (rates.error) throw rates.error;
      return {
        blocked: new Map(blocked.data.map((b) => [b.date as string, (b.reason as string) ?? ""])),
        rates: new Map(rates.data.map((r) => [r.date as string, Number(r.rate)])),
      };
    },
  });
}

const card = "rounded-2xl border border-sand-200 bg-white p-4 shadow-level-1";

function ResortPanel({
  unit,
  occupancy,
  sold,
  value,
  pending,
}: {
  unit: Unit;
  occupancy: number;
  sold: number;
  value: number;
  pending: number;
}) {
  return (
    <>
      <div className={card}>
        <p className="text-sm font-semibold text-ink">This month</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini label="Booked" value={`${occupancy}%`} />
          <Mini label="Nights" value={String(sold)} />
          <Mini label="Value" value={compactMoney(value)} />
        </div>
        {pending > 0 && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            <Clock3 className="size-3.5" /> {plural(pending, "request")} waiting for you to confirm
          </p>
        )}
      </div>
      <div className={card}>
        <p className="text-sm font-semibold text-ink">Pricing</p>
        <p className="mt-1 text-sm text-ink-muted">
          {money(unit.base_rate, true)} Sun–Thu
          {unit.weekend_rate != null && ` · ${money(unit.weekend_rate, true)} Fri–Sat`}
        </p>
        {unit.extra_guest_fee > 0 && (
          <p className="text-xs text-ink-muted">
            +{money(unit.extra_guest_fee, true)} a night per guest over {unit.capacity}
          </p>
        )}
      </div>
      <div className={card}>
        <p className="text-sm font-semibold text-ink">How to edit</p>
        <p className="mt-1 text-sm text-ink-muted">
          Drag across nights, or click one and then another, to close them, change the price or add a booking. Click a
          booking to open it.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ink-muted">
          <Legend className="border border-sand-300 bg-white">Free</Legend>
          <Legend className="bg-brand-700">Booked</Legend>
          <Legend className="bg-sky-600">In house</Legend>
          <Legend className="bg-amber-300">Pending</Legend>
          <Legend className="hatch bg-sand-100">Closed</Legend>
          <li className="flex items-center gap-1.5">
            <Tag className="size-3 text-terra-500" /> Special price
          </li>
        </ul>
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sand-100 px-2 py-2">
      <p className="font-display text-lg leading-tight text-ink tabular-nums">{value}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[3px]", className)} /> {children}
    </li>
  );
}

function SelectionPanel({
  unit,
  selection,
  byNight,
  blocked,
  overrides,
  onClear,
  onOpenBooking,
  onCreate,
}: {
  unit: Unit;
  selection: Sel;
  byNight: Map<string, BookingSummary>;
  blocked: Map<string, string>;
  overrides: Map<string, number>;
  onClear: () => void;
  onOpenBooking: (id: string) => void;
  onCreate: () => void;
}) {
  const qc = useQueryClient();
  const nights = nightsOf(selection);
  const checkOut = next(selection.end);
  const booked = [...new Set(nights.map((d) => byNight.get(d)).filter(Boolean))] as BookingSummary[];
  const closed = nights.filter((d) => !byNight.has(d) && blocked.has(d));
  const free = nights.filter((d) => !byNight.has(d) && !blocked.has(d));
  const allClosed = closed.length > 0 && free.length === 0;
  const priced = free.length ? free : nights;
  const rates = priced.map((d) => nightlyRate(unit, d, overrides));
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);

  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState(REASONS[0]!);
  const [price, setPrice] = useState(String(lo));
  const [busy, setBusy] = useState(false);
  const key = `${selection.start}|${selection.end}`;
  useEffect(() => {
    setBlocking(false);
    setPrice(String(lo));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => qc.invalidateQueries({ queryKey: ["calendar-extras"] }).then(() => qc.invalidateQueries({ queryKey: ["unavailable"] }));

  async function run(task: () => PromiseLike<{ error: unknown }>, done: string) {
    setBusy(true);
    const { error } = await task();
    setBusy(false);
    if (error) return void toast.error(errorMessage(error));
    await refresh();
    toast.success(done);
  }

  const touchedOverrides = free.filter((d) => overrides.has(d));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg leading-tight font-semibold whitespace-nowrap text-ink">{stayRange(selection.start, checkOut)}</p>
          <p className="text-xs text-ink-muted">
            {plural(nights.length, "night")} · check-out {format(parseISO(checkOut), "EEE, MMM d")}
            {booked.length > 0 && ` · ${plural(booked.length, "booking")} inside`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-sand-300 hover:bg-sand-100"
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>

      {(free.length > 0 || closed.length > 0) && (
        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {allClosed ? "Closed" : "Available"}
              <span className={cn("size-2 rounded-full", allClosed ? "bg-ink-muted" : "bg-emerald-500")} />
            </p>
            <div className="flex rounded-full bg-sand-100 p-0.5" role="group" aria-label="Availability">
              <button
                type="button"
                aria-label="Close these nights"
                disabled={busy || free.length === 0}
                onClick={() => setBlocking(true)}
                className={cn(
                  "grid h-8 w-11 cursor-pointer place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40",
                  (allClosed || blocking) && "bg-white shadow-level-1",
                )}
              >
                <X className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Open these nights"
                disabled={busy || closed.length === 0}
                onClick={() =>
                  run(
                    () => supabase.from("blocked_dates").delete().eq("unit_id", unit.id).in("date", closed),
                    `${plural(closed.length, "night")} open for booking again`,
                  )
                }
                className={cn(
                  "grid h-8 w-11 cursor-pointer place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40",
                  !allClosed && !blocking && free.length > 0 && "bg-white shadow-level-1",
                )}
              >
                <Check className="size-4" />
              </button>
            </div>
          </div>
          {closed.length > 0 && !allClosed && (
            <p className="mt-2 text-xs text-ink-muted">
              {closed.length} of these nights {closed.length === 1 ? "is" : "are"} closed. ✓ opens {closed.length === 1 ? "it" : "them"}.
            </p>
          )}
          {blocking && (
            <div className="mt-3 space-y-2.5 border-t border-sand-200 pt-3">
              <p className="text-xs text-ink-muted">Why {free.length === 1 ? "is this night" : `are these ${free.length} nights`} closed?</p>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition",
                      reason === r ? "border-ink bg-ink text-white" : "border-sand-300 hover:border-ink/40",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={busy}
                  onClick={() =>
                    run(
                      () =>
                        supabase
                          .from("blocked_dates")
                          .upsert(free.map((date) => ({ unit_id: unit.id, date, reason })), { onConflict: "unit_id,date" }),
                      `${plural(free.length, "night")} closed · ${reason}`,
                    ).then(() => setBlocking(false))
                  }
                >
                  Close {plural(free.length, "night")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBlocking(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {free.length > 0 && (
        <div className={card}>
          <p className="text-sm font-semibold text-ink">Nightly price</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Now {lo === hi ? money(lo, true) : `${compactMoney(lo)} – ${compactMoney(hi)}`}
            {touchedOverrides.length > 0 ? ` · ${touchedOverrides.length} with a special price` : " · standard rate"}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">₱</span>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pl-7 text-base font-semibold"
                aria-label="Nightly price"
              />
            </div>
            <Button
              loading={busy}
              disabled={!(Number(price) >= 0) || price === ""}
              onClick={() =>
                run(
                  () =>
                    supabase
                      .from("rate_overrides")
                      .upsert(free.map((date) => ({ unit_id: unit.id, date, rate: Number(price) })), {
                        onConflict: "unit_id,date",
                      }),
                  `${money(Number(price), true)} set for ${plural(free.length, "night")}`,
                )
              }
            >
              Save
            </Button>
          </div>
          {touchedOverrides.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => supabase.from("rate_overrides").delete().eq("unit_id", unit.id).in("date", touchedOverrides),
                  "Back to the standard rate",
                )
              }
              className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              <RotateCcw className="size-3" /> Reset to standard rate
            </button>
          )}
        </div>
      )}

      {free.length === nights.length && (
        <Button className="w-full" onClick={onCreate}>
          <CalendarPlus className="size-4" /> Add a booking for these dates
        </Button>
      )}

      {booked.length > 0 && (
        <div className={card}>
          <p className="text-sm font-semibold text-ink">Booked</p>
          <ul className="mt-2 space-y-2">
            {booked.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onOpenBooking(b.id)}
                  className="w-full cursor-pointer rounded-xl border border-sand-200 p-3 text-left hover:border-sand-300"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{b.guest_name}</span>
                    <StatusBadge status={b.status} />
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {stayRange(b.check_in, b.check_out)} · {plural(b.guests_count, "guest")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
