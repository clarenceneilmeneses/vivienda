import { differenceInCalendarDays, format, parseISO } from "date-fns";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
const pesoRound = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export function money(n: number | string | null | undefined, round = false) {
  const v = Number(n ?? 0);
  return (round ? pesoRound : peso).format(Number.isFinite(v) ? v : 0);
}

export function compactMoney(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₱${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `₱${Math.round(n)}`;
}

/** "YYYY-MM-DD" from a local Date, without the UTC shift toISOString causes. */
export function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function prettyDate(s: string | null | undefined, pattern = "MMM d, yyyy") {
  if (!s) return "—";
  return format(parseISO(s), pattern);
}

export function stayRange(checkIn: string, checkOut: string) {
  const a = parseISO(checkIn);
  const b = parseISO(checkOut);
  const sameYear = a.getFullYear() === b.getFullYear();
  if (sameYear && a.getMonth() === b.getMonth()) return `${format(a, "MMM d")}–${format(b, "d, yyyy")}`;
  if (sameYear) return `${format(a, "MMM d")} – ${format(b, "MMM d, yyyy")}`;
  return `${format(a, "MMM d, yyyy")} – ${format(b, "MMM d, yyyy")}`;
}

export function nightsBetween(checkIn: string, checkOut: string) {
  return differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

/** "14:00" → "2:00 PM" */
export function prettyTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
