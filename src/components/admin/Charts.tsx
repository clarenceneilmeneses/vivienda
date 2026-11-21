import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, money } from "../../lib/format";

// Malaya's single-hue approach: one brown, told apart by lightness, which
// survives every kind of colour blindness. Income is the dark end.
export const SERIES = {
  income: "#7b4821",
  // Darkened 2026-11-21 to clear 3:1 against the card (was #c19c7f, 2.46:1).
  expenses: "#b48a66",
  /** A loss: the terra of the brand, always with a minus sign beside it. */
  loss: "#a4471f",
} as const;

export interface MonthPoint {
  label: string;
  income: number;
  expenses: number;
}

const axis = { fontSize: 11, fill: "#5b5b5b" };

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string; color?: string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const byKey = Object.fromEntries(payload.map((p) => [String(p.dataKey), Number(p.value ?? 0)]));
  const net = (byKey.income ?? 0) - (byKey.expenses ?? 0);
  return (
    <div className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs shadow-level-3">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} />
            {p.dataKey === "income" ? "Income" : "Expenses"}
          </span>
          <span className="tabular-nums text-ink">{money(Number(p.value ?? 0))}</span>
        </p>
      ))}
      {"expenses" in byKey && (
        <p className="mt-1 flex justify-between gap-4 border-t border-sand-200 pt-1 font-medium text-ink">
          <span>Net</span>
          <span className="tabular-nums">{money(net)}</span>
        </p>
      )}
    </div>
  );
}

export function IncomeExpenseChart({ data, showExpenses = true }: { data: MonthPoint[]; showExpenses?: boolean }) {
  return (
    <div>
      {showExpenses && (
        <ul className="mb-3 flex gap-4 text-xs text-ink-soft" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES.income }} /> Income
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES.expenses }} /> Expenses
          </li>
        </ul>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e9e7e2" strokeDasharray="0" />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "#dbd9d3" }} />
            <YAxis
              tick={axis}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => compactMoney(v)}
            />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(123,72,33,0.06)" }} />
            <Bar dataKey="income" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            {showExpenses && <Bar dataKey="expenses" fill={SERIES.expenses} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Horizontal share bars for a single measure (e.g. expenses by category). */
export function ShareBars({
  rows,
  color,
  empty,
}: {
  rows: { label: string; value: number }[];
  color: string;
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!rows.length || total <= 0) return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${money(r.value)}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="text-ink-soft">{r.label}</span>
            <span className="tabular-nums">
              {money(r.value, true)}
              <span className="ml-1.5 text-xs text-ink-muted">{Math.round((r.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-sand-100">
            <div
              className="h-2 rounded-full"
              style={{ width: `${max ? (r.value / max) * 100 : 0}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SimpleTip({
  active,
  payload,
  label,
  name,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
  name: string;
}) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0].value ?? 0);
  return (
    <div className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs shadow-level-3">
      <p className="mb-0.5 font-semibold text-ink">{label}</p>
      <p className="flex justify-between gap-4 text-ink-soft">
        <span>{name}</span>
        <span className="tabular-nums text-ink">{money(v)}</span>
      </p>
    </div>
  );
}

/** Net profit per month: one bar each, brown above zero, terra below, zero line drawn. */
export function NetBars({ data }: { data: { label: string; net: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e9e7e2" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactMoney(v)} />
          <ReferenceLine y={0} stroke="#bdb9b0" />
          <Tooltip content={<SimpleTip name="Net profit" />} cursor={{ fill: "rgba(123,72,33,0.06)" }} />
          <Bar dataKey="net" maxBarSize={28} isAnimationActive={false} radius={4}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.net < 0 ? SERIES.loss : SERIES.income} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Money in per day across the period: a single soft area with a crosshair tooltip. */
export function DailyArea({ data, name = "Collected" }: { data: { label: string; value: number }[]; name?: string }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dailyFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={SERIES.income} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES.income} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e9e7e2" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactMoney(v)} />
          <Tooltip content={<SimpleTip name={name} />} cursor={{ stroke: "#bdb9b0", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={SERIES.income}
            strokeWidth={2}
            fill="url(#dailyFill)"
            isAnimationActive={false}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
