import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronDown, X } from "lucide-react";
import { PRESETS, useAdminRange } from "../../lib/admin-range";
import { cn } from "../../lib/utils";

/**
 * The top bar's date filter, after Malaya's DatePicker: the preset and the
 * dates it means on the button ("This month · Nov 1 – 30, 2026"), a grid of
 * presets, and From/To for anything else. A × beside it, only while it is off
 * This month, puts it back.
 */
export function DateFilter({ className, align = "right" }: { className?: string; align?: "left" | "right" }) {
  const r = useAdminRange();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className={cn("relative flex items-center", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Dates the screens show"
        title="Dates the screens show"
        className="inline-flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-full px-3 text-sm text-ink transition-colors hover:bg-sand-100"
      >
        <CalendarRange className="size-4 shrink-0 text-ink-muted" />
        <span className="truncate">
          {r.preset === "custom" ? (
            r.label
          ) : (
            <>
              {r.name}
              <span className="hidden text-ink-muted sm:inline"> · {r.label}</span>
            </>
          )}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </button>
      {r.active && (
        <button
          type="button"
          onClick={r.reset}
          aria-label="Back to this month"
          title="Back to this month"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      )}

      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-sand-200 bg-white p-3 shadow-level-4",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  r.setPreset(p.value);
                  setOpen(false);
                }}
                className={cn(
                  "h-8 cursor-pointer rounded-full px-3 text-left text-sm transition-colors",
                  r.preset === p.value ? "bg-sand-100 font-medium text-brand-700" : "text-ink-soft hover:bg-sand-100/60 hover:text-ink",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-sand-200 pt-3">
            <p className="eyebrow">Or set the dates</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-ink-muted">
                From
                <input
                  type="date"
                  value={r.from}
                  max={r.to}
                  onChange={(e) => e.target.value && r.setCustom(e.target.value, r.to)}
                  className="mt-1 h-9 w-full rounded-xl border border-sand-300 bg-white px-2 text-sm text-ink focus:border-brand-700 focus:outline-none"
                />
              </label>
              <label className="text-xs text-ink-muted">
                To
                <input
                  type="date"
                  value={r.to}
                  min={r.from}
                  onChange={(e) => e.target.value && r.setCustom(r.from, e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-sand-300 bg-white px-2 text-sm text-ink focus:border-brand-700 focus:outline-none"
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">
              Showing {r.label}. The Dashboard, Finance and Bookings all follow this.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
