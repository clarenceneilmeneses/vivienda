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
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  unavailable: Set<string>;
  minDate?: string;
  months?: 1 | 2;
  onVisibleMonthChange?: (firstMonth: Date) => void;
  dayNote?: (iso: string) => string | null;
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

  function move(delta: number) {
    const next = addMonths(first, delta);
    setFirst(next);
    onVisibleMonthChange?.(next);
  }

  function pick(iso: string) {
    const { checkIn, checkOut } = value;
    const choosingEnd = checkIn && !checkOut;
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
          className="rounded-md p-1.5 text-ink-soft hover:bg-sand-100 disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex flex-1 justify-around text-sm font-semibold text-ink">
          {Array.from({ length: months }, (_, i) => (
            <span key={i} className={cn(i > 0 && "hidden sm:inline")}>
              {format(addMonths(first, i), "MMMM yyyy")}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          className="rounded-md p-1.5 text-ink-soft hover:bg-sand-100"
          aria-label="Next month"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className={cn("grid gap-6", months === 2 && "sm:grid-cols-2")}>
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
  onPick: (iso: string) => void;
  dayNote?: (iso: string) => string | null;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });
  const { checkIn, checkOut } = value;
  const rangeEnd = checkOut ?? (checkIn && hover && maxCheckout && hover > checkIn && hover <= maxCheckout ? hover : null);

  return (
    <div className={className}>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-muted">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
        {days.map((d) => {
          const iso = isoDate(d);
          if (!isSameMonth(d, month)) return <div key={iso} />;
          const past = iso < min;
          const taken = unavailable.has(iso);
          const asCheckout = Boolean(checkIn && !checkOut && maxCheckout && iso > checkIn && iso <= maxCheckout);
          const disabled = past || (taken && !asCheckout);
          const isStart = iso === checkIn;
          const isEnd = iso === rangeEnd;
          const inRange = Boolean(checkIn && rangeEnd && iso > checkIn && iso < rangeEnd);
          const note = !disabled && dayNote ? dayNote(iso) : null;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              onMouseEnter={() => setHover(iso)}
              aria-pressed={isStart || isEnd}
              aria-label={`${format(d, "EEEE, MMMM d")}${taken ? ", unavailable" : ""}`}
              className={cn(
                "relative flex h-12 flex-col items-center justify-center text-sm transition-colors",
                inRange && "bg-forest-50",
                isStart && rangeEnd && "rounded-l-lg",
                isEnd && "rounded-r-lg",
                disabled ? "cursor-not-allowed text-ink-muted/50" : "text-ink hover:bg-sand-100",
                taken && !asCheckout && !past && "line-through decoration-ink-muted/60",
                (isStart || isEnd) && "rounded-lg bg-forest-700 text-sand-50 hover:bg-forest-700",
              )}
            >
              <span className="leading-none">{format(d, "d")}</span>
              {note && (
                <span
                  className={cn(
                    "mt-0.5 text-[10px] leading-none",
                    isStart || isEnd ? "text-sand-100" : "text-ink-muted",
                  )}
                >
                  {note}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
