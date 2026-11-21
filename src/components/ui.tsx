import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Eye, Loader2, Search as SearchIcon, X } from "lucide-react";
import { cn } from "../lib/utils";
import type { BookingStatus } from "../lib/types";
import { STATUS_LABEL } from "../lib/types";

/**
 * Buttons say what they do, as in Malaya (2026-10-09):
 *   success  moves something forward: Confirm, Check in, Record payment, Publish.
 *   danger   Decline, Cancel, Delete, on the page (red outline). The question
 *            behind it confirms with danger-solid.
 *   secondary  everything else with words, Cancel included. The 1px ledge under
 *            the edge is what makes a white button read as something to press.
 *   ghost    icon-only buttons, whose icon already says "press me".
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid" | "success" | "accent";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-sand-50 shadow-level-1 hover:bg-brand-700/90 disabled:bg-brand-700/50",
  accent: "bg-brand-700 text-sand-50 shadow-level-2 hover:bg-brand-700/90 disabled:bg-brand-700/50",
  secondary:
    "bg-white text-ink border border-sand-300 shadow-[0_1px_0_var(--color-sand-300),0_2px_3px_rgb(0_0_0/0.06)] hover:bg-sand-100 disabled:opacity-50",
  ghost: "text-ink-soft hover:bg-sand-100 hover:text-ink disabled:opacity-50",
  danger:
    "bg-white text-red-700 border border-red-300 shadow-[0_1px_0_rgb(252_165_165),0_2px_3px_rgb(0_0_0/0.06)] hover:bg-red-50 disabled:opacity-50",
  "danger-solid": "bg-red-600 text-white shadow-level-1 hover:bg-red-700 disabled:opacity-50",
  success: "bg-emerald-700 text-white shadow-level-1 hover:bg-emerald-800 disabled:opacity-50",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", title, ...rest },
  ref,
) {
  // An icon-only button says what it does on hover: its aria-label becomes the tooltip.
  const label = rest["aria-label"];
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      title={title ?? (typeof label === "string" ? label : undefined)}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-xl font-medium transition-[color,background-color,border-color,transform] active:translate-y-px disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

const fieldBase =
  "w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-ink placeholder:text-ink-muted/70 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15 disabled:bg-sand-100 disabled:text-ink-muted";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(fieldBase, "py-2 leading-relaxed", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-10 cursor-pointer pr-9", className)} {...rest}>
      {children}
    </select>
  );
});

/** Label + control + hint/error. Pass a render function to get the generated id. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  optional?: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-muted">(optional)</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-red-700">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-sand-200/80 bg-white shadow-level-2", className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-sand-200 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-base font-medium text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const statusStyles: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  checked_in: "bg-sky-50 text-sky-800 ring-sky-200",
  checked_out: "bg-sand-100 text-ink-soft ring-sand-300",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
  declined: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        statusStyles[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-sm text-ink-muted", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-sand-100 text-brand-700 [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="font-display text-lg text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div role="alert" className={cn("rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800", className)}>
      {children}
    </div>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEscape(open, onClose);
  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-espresso/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-level-4 sm:rounded-3xl",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-sand-200/80 px-6 py-5">
          <div>
            <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-sand-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-sand-200/80 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-espresso/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" className="relative flex h-full w-full max-w-xl flex-col bg-sand-50 shadow-level-4 sm:m-3 sm:h-[calc(100%-1.5rem)] sm:overflow-hidden sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-sand-200/80 bg-white px-5 py-4">
          <div className="min-w-0 flex-1">{title}</div>
          {headerExtra}
          <button onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-sand-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  /** waiting: an amber count while above zero, for something waiting on you. */
  items: { value: T; label: string; count?: number; waiting?: boolean }[];
  className?: string;
}) {
  // Malaya's chip strip: one white, lifted, fully rounded pill; the open chip a soft fill.
  return (
    <div className={cn("no-scrollbar max-w-full overflow-x-auto", className)}>
      <div className="inline-flex items-center gap-0.5 rounded-full border border-sand-200/80 bg-white p-1 shadow-level-1" role="tablist">
        {items.map((it) => {
          const on = value === it.value;
          const amber = it.waiting && (it.count ?? 0) > 0;
          return (
            <button
              key={it.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(it.value)}
              className={cn(
                "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors",
                on ? "bg-sand-100 font-medium text-brand-700" : "text-ink-muted hover:bg-sand-100/60 hover:text-ink",
              )}
            >
              {it.label}
              {it.count != null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold tabular-nums",
                    amber ? "bg-amber-100 text-amber-800" : on ? "bg-white text-brand-700" : "bg-sand-100 text-ink-muted",
                  )}
                >
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-sand-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-medium text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A KPI tile, after Malaya's KpiCard: eyebrow label, display-size value, a faint brand glow. */
export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "warn";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "lift relative h-full overflow-hidden rounded-2xl border border-sand-200/80 bg-white p-5 shadow-level-2",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full bg-brand-700/5 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {icon && <span className="text-brand-700/70 [&_svg]:size-4">{icon}</span>}
      </div>
      <p
        className={cn(
          "relative mt-2 font-display text-[26px] leading-tight tabular-nums sm:text-[28px]",
          tone === "warn" ? "text-terra-600" : "text-ink",
        )}
      >
        {value}
      </p>
      {sub && <p className="relative mt-1 truncate text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

// ───────────────────────── asking first ─────────────────────────

export interface AskOptions {
  title: string;
  description?: ReactNode;
  /** Worded as the action, never "OK": "Delete booking", "Unsend". */
  confirmLabel: string;
  tone?: "danger" | "success" | "primary";
}

let pending: ((o: AskOptions & { resolve: (v: boolean) => void }) => void) | null = null;

/**
 * Asks before a red or green button does what it says (Malaya's ConfirmAction).
 * Resolves true when confirmed. Needs <ConfirmHost /> mounted once.
 */
export function ask(o: AskOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pending) return resolve(window.confirm(o.title));
    pending({ ...o, resolve });
  });
}

export function ConfirmHost() {
  const [q, setQ] = useState<(AskOptions & { resolve: (v: boolean) => void }) | null>(null);
  useEffect(() => {
    pending = setQ;
    return () => {
      pending = null;
    };
  }, []);
  if (!q) return null;
  const close = (v: boolean) => {
    q.resolve(v);
    setQ(null);
  };
  return (
    <Modal
      open
      size="sm"
      onClose={() => close(false)}
      title={q.title}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Go back
          </Button>
          <Button
            autoFocus
            variant={q.tone === "success" ? "success" : q.tone === "primary" ? "primary" : "danger-solid"}
            onClick={() => close(true)}
          >
            {q.confirmLabel}
          </Button>
        </>
      }
    >
      {q.description ? <div className="text-sm text-ink-soft">{q.description}</div> : <p className="text-sm text-ink-muted">This can't be undone.</p>}
    </Modal>
  );
}

// ───────────────────────── list pages ─────────────────────────

/**
 * Every list page's toolbar, in one layout (Malaya, 2026-10-20): the chip
 * strip on the left, search and the rest on the right, all the same height,
 * sitting on the page above the table rather than crammed into its card.
 */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between", className)}>{children}</div>
  );
}

/** A search box shaped like the chip strip beside it: a white, lifted pill. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-[42px] items-center gap-2 rounded-full border border-sand-200/80 bg-white pr-1.5 pl-4 shadow-level-1 focus-within:border-brand-700/50 sm:w-72",
        className,
      )}
    >
      <SearchIcon className="size-4 shrink-0 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="grid size-7 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100"
          aria-label="Clear search"
          title="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
}

/** The row of stat cards at the top of a page. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>{children}</div>;
}

/**
 * A filter shaped like the search pill: a white, lifted, rounded select.
 * Reads as set (brand ring) whenever it is off its first option.
 */
export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  /** Says what the filter is about, for screen readers and the tooltip. */
  label: string;
  className?: string;
}) {
  const set = options.length > 0 && value !== options[0].value;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      aria-label={label}
      title={label}
      className={cn(
        "h-[42px] cursor-pointer rounded-full border bg-white pr-10 pl-4 text-sm shadow-level-1 focus:border-brand-700/50 focus:outline-none",
        set ? "border-brand-700/40 font-medium text-brand-700" : "border-sand-200/80 text-ink",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** The right side of a toolbar: search, filters and a clear button, wrapping on a phone. */
export function ToolbarGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/** Shows "Clear filters" only while something is set. */
export function ClearFilters({ active, onClear }: { active: boolean; onClear: () => void }) {
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex h-[42px] cursor-pointer items-center gap-1 rounded-full px-3 text-sm text-ink-muted hover:bg-sand-100 hover:text-ink"
    >
      <X className="size-3.5" /> Clear
    </button>
  );
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;

/**
 * Slices a list into pages. Goes back to page 1 whenever `resetKey` changes
 * (a new tab, search or filter), and never sits past the last page.
 */
export function usePaged<T>(rows: T[], resetKey: unknown, initialSize = 25) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(initialSize);
  const key = JSON.stringify(resetKey);
  useEffect(() => setPage(1), [key, size]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  return {
    items: rows.slice(start, start + size),
    page: current,
    pages,
    size,
    total: rows.length,
    start,
    setPage,
    setSize,
  };
}

/** The footer under a paged table: where you are, rows per page, and the page buttons. */
export function Pagination({
  paged,
  noun = "row",
}: {
  paged: Pick<ReturnType<typeof usePaged<unknown>>, "page" | "pages" | "size" | "total" | "start" | "setPage" | "setSize">;
  noun?: string;
}) {
  const { page, pages, size, total, start, setPage, setSize } = paged;
  if (total === 0) return null;
  const end = Math.min(start + size, total);
  // Up to five page numbers around the current one, with the first and last always there.
  const nums: (number | "…")[] = [];
  const lo = Math.max(1, Math.min(page - 2, pages - 4));
  const hi = Math.min(pages, lo + 4);
  if (lo > 1) nums.push(1, ...(lo > 2 ? (["…"] as const) : []));
  for (let i = lo; i <= hi; i++) nums.push(i);
  if (hi < pages) nums.push(...(hi < pages - 1 ? (["…"] as const) : []), pages);
  const btn =
    "grid h-8 min-w-8 cursor-pointer place-items-center rounded-lg px-2 text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-col gap-2 border-t border-sand-200 px-4 py-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {start + 1}–{end} of {total} {total === 1 ? noun : `${noun}s`}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Show</span>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-8 cursor-pointer rounded-lg border border-sand-300 bg-white bg-[position:right_0.4rem_center] pr-7 pl-2.5 text-sm text-ink focus:outline-none"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pages">
          <button type="button" className={cn(btn, "hover:bg-sand-100")} disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page" title="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {nums.map((n, i) =>
            n === "…" ? (
              <span key={`gap${i}`} className="px-1">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === page ? "page" : undefined}
                className={cn(btn, n === page ? "bg-brand-700 font-medium text-sand-50" : "text-ink hover:bg-sand-100")}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" className={cn(btn, "hover:bg-sand-100")} disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Next page" title="Next page">
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

/** A row's "View" button: opens the record. Stops the click so the row's own handler doesn't fire twice. */
export function ViewButton({ onClick, label = "View" }: { onClick: () => void; label?: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Eye className="size-3.5" /> {label}
    </Button>
  );
}
