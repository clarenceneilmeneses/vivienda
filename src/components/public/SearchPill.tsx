import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, Minus, Plus, Search, Users } from "lucide-react";
import { RangeCalendar } from "../RangeCalendar";
import { prettyDate } from "../../lib/format";
import { cn } from "../../lib/utils";

export interface StaySearch {
  checkIn: string;
  checkOut: string;
  guests: number;
}

const EMPTY = new Set<string>();

/**
 * Malaya's four-field search pill, less the location (Vivienda is one place):
 * check-in, check-out, guests and a Search button. One pill at every width;
 * on a phone the two dates share a field.
 */
export function SearchPill({
  value,
  onChange,
  onSearch,
  maxGuests,
}: {
  value: StaySearch;
  onChange: (v: StaySearch) => void;
  onSearch: () => void;
  maxGuests: number;
}) {
  const [open, setOpen] = useState<null | "dates" | "guests">(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const short = (iso: string) => (iso ? prettyDate(iso, "MMM d") : "");
  const guestLabel = `${value.guests} guest${value.guests === 1 ? "" : "s"}`;
  const toggle = (name: "dates" | "guests") => setOpen((o) => (o === name ? null : name));

  function search() {
    setOpen(null);
    onSearch();
  }

  return (
    <div ref={box} className="relative mx-auto max-w-3xl">
      <div className="rounded-2xl border border-sand-200/60 bg-white p-1.5 text-left shadow-level-3 sm:p-2">
        {/* Phone: dates | guests | icon button */}
        <div className="flex items-stretch sm:hidden">
          <PillField
            active={open === "dates"}
            onClick={() => toggle("dates")}
            icon={<CalendarDays className="size-4" />}
            label="Dates"
            value={value.checkIn ? `${short(value.checkIn)} – ${value.checkOut ? short(value.checkOut) : "…"}` : ""}
            placeholder="Add dates"
          />
          <Divider />
          <PillField
            active={open === "guests"}
            onClick={() => toggle("guests")}
            icon={<Users className="size-4" />}
            label="Guests"
            value={guestLabel}
            placeholder=""
          />
          <button
            type="button"
            onClick={search}
            aria-label="Search stays"
            className="ml-1 grid w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-brand-700 text-sand-50 hover:bg-brand-700/90"
          >
            <Search className="size-4" />
          </button>
        </div>

        {/* From sm: check-in | check-out | guests | Search */}
        <div className="hidden items-stretch sm:flex">
          <PillField
            active={open === "dates" && !value.checkIn}
            onClick={() => toggle("dates")}
            icon={<CalendarDays className="size-[18px]" />}
            label="Check-in"
            value={short(value.checkIn)}
            placeholder="Add dates"
          />
          <Divider />
          <PillField
            active={open === "dates" && Boolean(value.checkIn)}
            onClick={() => toggle("dates")}
            icon={<CalendarDays className="size-[18px]" />}
            label="Check-out"
            value={short(value.checkOut)}
            placeholder="Add dates"
          />
          <Divider />
          <PillField
            active={open === "guests"}
            onClick={() => toggle("guests")}
            icon={<Users className="size-[18px]" />}
            label="Guests"
            value={guestLabel}
            placeholder=""
            chevron
          />
          <button
            type="button"
            onClick={search}
            className="ml-2 inline-flex h-12 shrink-0 cursor-pointer items-center gap-2 self-center rounded-xl bg-brand-700 px-6 text-sm font-medium text-sand-50 shadow-level-1 transition-colors hover:bg-brand-700/90"
          >
            <Search className="size-4" /> Search
          </button>
        </div>
      </div>

      {open === "dates" && (
        <div className="absolute inset-x-0 top-full z-30 mt-3 rounded-2xl border border-sand-200/70 bg-white p-4 shadow-level-4 sm:p-5">
          <RangeCalendar
            value={{ checkIn: value.checkIn || null, checkOut: value.checkOut || null }}
            onChange={(r) => {
              onChange({ ...value, checkIn: r.checkIn ?? "", checkOut: r.checkOut ?? "" });
              if (r.checkIn && r.checkOut) setOpen(null);
            }}
            unavailable={EMPTY}
          />
          {value.checkIn && (
            <div className="mt-2 border-t border-sand-200/70 pt-2 text-right">
              <button
                type="button"
                onClick={() => onChange({ ...value, checkIn: "", checkOut: "" })}
                className="cursor-pointer text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
              >
                Clear dates
              </button>
            </div>
          )}
        </div>
      )}

      {open === "guests" && (
        <div className="absolute top-full right-0 z-30 mt-3 w-72 rounded-2xl border border-sand-200/70 bg-white p-5 shadow-level-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Guests</p>
              <p className="text-xs text-ink-muted">Up to {maxGuests}</p>
            </div>
            <Stepper value={value.guests} min={1} max={maxGuests} onChange={(g) => onChange({ ...value, guests: g })} />
          </div>
        </div>
      )}
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const btn =
    "grid size-8 cursor-pointer place-items-center rounded-full border border-sand-300 text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Fewer guests">
        <Minus className="size-3.5" />
      </button>
      <output className="w-6 text-center text-sm font-medium tabular-nums">{value}</output>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More guests">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="my-2 w-px shrink-0 self-stretch bg-sand-300/50" />;
}

function PillField({
  active,
  onClick,
  icon,
  label,
  value,
  placeholder,
  chevron,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  value: string;
  placeholder: string;
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "group flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-sand-100 sm:gap-3 sm:px-4",
        active && "bg-sand-100",
      )}
    >
      <span className="shrink-0 text-brand-700">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[9px] font-semibold tracking-[0.08em] text-ink uppercase sm:text-[11px]">
          {label}
        </span>
        <span className={cn("mt-0.5 block truncate text-xs sm:text-sm", value ? "text-ink" : "text-ink-muted")}>
          {value || placeholder}
        </span>
      </span>
      {chevron && (
        <ChevronDown
          aria-hidden
          className={cn("hidden size-4 shrink-0 text-ink-muted transition-transform sm:block", active && "rotate-180")}
        />
      )}
    </button>
  );
}
