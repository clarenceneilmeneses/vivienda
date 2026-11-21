import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { isoDate } from "../lib/format";

export interface DateRange {
  checkIn: string | null;
  checkOut: string | null;
}

/**
 * Two-click stay picker. `unavailable` holds nights (YYYY-MM-DD) that can't be
 * slept in. A taken night can still be someone's check-out day, so after a
 * check-in is picked, the first taken night after it stays clickable.
 */
export function RangeCalendar({
  value,
  onChange,
  unavailable,
  minDate,
  months = 2,
  onVisibleMonthChange,
  dayNote,
  minNights,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  unavailable: Set<string>;
  minDate?: string;
  months?: 1 | 2;
  onVisibleMonthChange?: (firstMonth: Date) => void;
  dayNote?: (iso: string) => string | null;
  /** The shortest stay allowed from a check-in date. Shorter check-outs can't be picked. */
  minNights?: (checkIn: string) => number;
}) {
  const [first, setFirst] = useState(() => startOfMonth(value.checkIn ? parseISO(value.checkIn) : new Date()));
  const [hover, setHover] = useState<string | null>(null);
  const min = minDate ?? isoDate(new Date());

  // While choosing a check-out: the last day that may be picked.
  const maxCheckout = useMemo(() => {
    if (!value.checkIn || value.checkOut) return null;
    let d = parseISO(value.checkIn);
    for (let i = 0; i < 90; i++) {
      d = addDays(d, 1);
      if (unavailable.has(isoDate(d))) return isoDate(d);
    }
    return isoDate(d);
  }, [value.checkIn, value.checkOut, unavailable]);

  // While choosing a check-out: the first day that may be picked.
  const minCheckout = useMemo(() => {
    if (!value.checkIn || value.checkOut) return null;
    return isoDate(addDays(parseISO(value.checkIn), Math.max(1, minNights?.(value.checkIn) ?? 1)));
  }, [value.checkIn, value.checkOut, minNights]);

  function move(delta: number) {
    const next = addMonths(first, delta);
    setFirst(next);
    onVisibleMonthChange?.(next);
  }

  function pick(iso: string) {
    const { checkIn, checkOut } = value;
    const choosingEnd = checkIn && !checkOut;
    if (choosingEnd && iso > checkIn && minCheckout && iso < minCheckout) return;
    if (choosingEnd && iso > checkIn && maxCheckout && iso <= maxCheckout) {
      onChange({ checkIn, checkOut: iso });
      return;
    }
    if (iso < min || unavailable.has(iso)) return;
    onChange({ checkIn: iso, checkOut: null });
  }

  const canGoBack = startOfMonth(first) > startOfMonth(parseISO(min));

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={!canGoBack}
          className="grid size-9 cursor-pointer place-items-center rounded-full border border-sand-200 text-ink-soft hover:bg-sand-100 disabled:cursor-default disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-1 justify-around font-display text-base text-ink">
          {Array.from({ length: months }, (_, i) => (
            <span key={i} className={cn(i > 0 && "hidden sm:inline")}>
              {format(addMonths(first, i), "MMMM yyyy")}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          className="grid size-9 cursor-pointer place-items-center rounded-full border border-sand-200 text-ink-soft hover:bg-sand-100"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className={cn("grid gap-8", months === 2 && "sm:grid-cols-2")}>
        {Array.from({ length: months }, (_, i) => (
          <Month
            key={i}
            month={addMonths(first, i)}
            className={cn(i > 0 && "hidden sm:block")}
            value={value}
            hover={hover}
            setHover={setHover}
            min={min}
            unavailable={unavailable}
            maxCheckout={maxCheckout}
            minCheckout={minCheckout}
            onPick={pick}
            dayNote={dayNote}
          />
        ))}
      </div>
    </div>
  );
}

function Month({
  month,
  className,
  value,
  hover,
  setHover,
  min,
  unavailable,
  maxCheckout,
  minCheckout,
  onPick,
  dayNote,
}: {
  month: Date;
  className?: string;
  value: DateRange;
  hover: string | null;
  setHover: (s: string | null) => void;
  min: string;
  unavailable: Set<string>;
  maxCheckout: string | null;
  minCheckout: string | null;
  onPick: (iso: string) => void;
  dayNote?: (iso: string) => string | null;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });
  const { checkIn, checkOut } = value;
  const canEnd = (iso: string) =>
    Boolean(checkIn && !checkOut && maxCheckout && iso > checkIn && iso <= maxCheckout && (!minCheckout || iso >= minCheckout));
  const rangeEnd = checkOut ?? (hover && canEnd(hover) ? hover : null);

  return (
    <div className={className}>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
        {days.map((d) => {
          const iso = isoDate(d);
          if (!isSameMonth(d, month)) return <div key={iso} />;
          const past = iso < min;
          const taken = unavailable.has(iso);
          const asCheckout = canEnd(iso);
          // Too short a stay: inside the minimum, while picking a check-out.
          const tooShort = Boolean(checkIn && !checkOut && minCheckout && iso > checkIn && iso < minCheckout);
          const disabled = past || tooShort || (taken && !asCheckout);
          const isStart = iso === checkIn;
          const isEnd = iso === rangeEnd;
          const inRange = Boolean(checkIn && rangeEnd && iso > checkIn && iso < rangeEnd);
          const note = !disabled && dayNote ? dayNote(iso) : null;
          const picked = isStart || isEnd;
          // The band joining check-in to check-out runs behind the circles:
          // half a cell from the start, half to the end, full across the nights.
          const band = inRange ? "inset-x-0" : isStart && rangeEnd ? "left-1/2 right-0" : isEnd && checkIn ? "left-0 right-1/2" : null;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              onMouseEnter={() => setHover(iso)}
              aria-pressed={picked}
              aria-label={`${format(d, "EEEE, MMMM d")}${taken ? ", unavailable" : ""}`}
              className={cn("group relative flex h-12 items-center justify-center", disabled ? "cursor-not-allowed" : "cursor-pointer")}
            >
              {band && <span aria-hidden className={cn("absolute inset-y-1 bg-brand-100/70", band)} />}
              <span
                className={cn(
                  "relative flex size-11 flex-col items-center justify-center rounded-full text-sm transition-colors",
                  picked
                    ? "bg-brand-700 font-semibold text-sand-50 shadow-level-2"
                    : disabled
                      ? "text-ink-muted/45"
                      : "text-ink group-hover:ring-1 group-hover:ring-ink/70",
                  taken && !asCheckout && !past && "line-through decoration-ink-muted/50",
                )}
              >
                <span className="leading-none">{format(d, "d")}</span>
                {note && (
                  <span className={cn("mt-1 text-[9px] leading-none tracking-tight", picked ? "text-sand-100/90" : "text-ink-muted/80")}>
                    {note}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
