import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  addDays,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
} from "date-fns";
import { isoDate } from "./format";

/**
 * The admin's one date filter, in the top bar (as in Malaya's scope bar):
 * every screen that adds things up over time reads the same From–To, so the
 * Dashboard, Finance and Bookings always talk about the same days. It starts
 * on This month, and is kept for the tab's session.
 */

export type RangePreset =
  | "today"
  | "yesterday"
  | "week"
  | "last-week"
  | "month"
  | "last-month"
  | "quarter"
  | "year"
  | "custom";

export const PRESETS: { value: Exclude<RangePreset, "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
];

export const DEFAULT_PRESET: RangePreset = "month";
const KEY = "vivienda:admin-range";

export function presetRange(p: Exclude<RangePreset, "custom">, now = new Date()) {
  const d = (a: Date, b: Date) => ({ from: isoDate(a), to: isoDate(b) });
  switch (p) {
    case "today":
      return d(now, now);
    case "yesterday":
      return d(addDays(now, -1), addDays(now, -1));
    case "week":
      return d(startOfWeek(now), endOfWeek(now));
    case "last-week":
      return d(startOfWeek(subWeeks(now, 1)), endOfWeek(subWeeks(now, 1)));
    case "month":
      return d(startOfMonth(now), endOfMonth(now));
    case "last-month":
      return d(startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1)));
    case "quarter":
      return d(startOfQuarter(now), endOfQuarter(now));
    case "year":
      return d(startOfYear(now), endOfYear(now));
  }
}

/** "Nov 1 – 30, 2026", "Nov 21, 2026", "Oct 28 – Nov 3, 2026". */
export function rangeLabel(from: string, to: string) {
  const a = parseISO(from);
  const b = parseISO(to);
  if (from === to) return format(a, "MMM d, yyyy");
  if (a.getFullYear() !== b.getFullYear()) return `${format(a, "MMM d, yyyy")} – ${format(b, "MMM d, yyyy")}`;
  if (a.getMonth() === b.getMonth()) return `${format(a, "MMM d")} – ${format(b, "d, yyyy")}`;
  return `${format(a, "MMM d")} – ${format(b, "MMM d, yyyy")}`;
}

interface Stored {
  preset: RangePreset;
  from?: string;
  to?: string;
}

interface Ctx {
  preset: RangePreset;
  from: string;
  to: string;
  /** Days in the range, both ends counted. */
  days: number;
  /** "This month", or the dates for a custom range. */
  name: string;
  /** "Nov 1 – 30, 2026". */
  label: string;
  /** Off the default (This month). */
  active: boolean;
  setPreset: (p: Exclude<RangePreset, "custom">) => void;
  setCustom: (from: string, to: string) => void;
  reset: () => void;
}

const RangeContext = createContext<Ctx | null>(null);

function read(): Stored {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    /* storage blocked */
  }
  return { preset: DEFAULT_PRESET };
}

export function AdminRangeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(read);
  const save = (next: Stored) => {
    setState(next);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<Ctx>(() => {
    const custom = state.preset === "custom" && state.from && state.to;
    const { from, to } = custom ? { from: state.from!, to: state.to! } : presetRange(state.preset === "custom" ? "month" : state.preset);
    const preset = custom ? "custom" : state.preset === "custom" ? DEFAULT_PRESET : state.preset;
    const days = Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000) + 1;
    const label = rangeLabel(from, to);
    return {
      preset,
      from,
      to,
      days,
      label,
      name: preset === "custom" ? label : (PRESETS.find((p) => p.value === preset)?.label ?? label),
      active: preset !== DEFAULT_PRESET,
      setPreset: (p) => save({ preset: p }),
      setCustom: (a, b) => save({ preset: "custom", from: a <= b ? a : b, to: a <= b ? b : a }),
      reset: () => save({ preset: DEFAULT_PRESET }),
    };
  }, [state]);

  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>;
}

export function useAdminRange() {
  const ctx = useContext(RangeContext);
  if (!ctx) throw new Error("useAdminRange needs AdminRangeProvider");
  return ctx;
}

/** Whether a stay [checkIn, checkOut) has a night inside the range. */
export function stayInRange(checkIn: string, checkOut: string, from: string, to: string) {
  return checkIn <= to && checkOut > from;
}
