import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, eachDayOfInterval, format } from "date-fns";
import { toast } from "sonner";
import {
  BarChart3,
  Download,
  FileText,
  ImageOff,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Table2,
  Trash2,
} from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { downloadCsv, isoDate, money, plural, prettyDate, stayRange } from "../../lib/format";
import { useAdminRange } from "../../lib/admin-range";
import {
  EXPENSE_CATEGORIES,
  METHOD_LABEL,
  SOURCE_LABEL,
  categoryLabel,
  type BookingSource,
  type BookingSummary,
  type Expense,
  type Payment,
  type PaymentMethod,
} from "../../lib/types";
import { useUnits } from "../../lib/queries";
import { isPdf, openReceipt, receiptColumnMissing, removeReceipt, useReceiptUrl } from "../../lib/receipts";
import { cn } from "../../lib/utils";
import {
  Button,
  ask,
  Badge,
  Card,
  CardHeader,
  ClearFilters,
  EmptyState,
  ErrorBox,
  Field,
  FilterSelect,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchField,
  Select,
  Spinner,
  StatGrid,
  StatTile,
  Tabs,
  Toolbar,
  ToolbarGroup,
  usePaged,
  ViewButton,
} from "../../components/ui";
import { DailyArea, IncomeExpenseChart, NetBars, SERIES, ShareBars, type MonthPoint } from "../../components/admin/Charts";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { ReceiptField } from "../../components/admin/ReceiptField";
import { useAllBookings } from "./Bookings";

/**
 * Finance, all in one (2026-11-21): the period's numbers and charts, every
 * payment and expense with its receipt, who still owes, all receipts in one
 * place, and the year's P&L. The top bar's dates decide the period; the
 * monthly charts and the P&L show that period's year. Reports turns any of it
 * into a PDF.
 */

export interface PaymentRow extends Payment {
  booking: { ref: string; unit_id: string; source: BookingSource; guest: { full_name: string } | null } | null;
}

type Tab = "overview" | "payments" | "expenses" | "unpaid" | "receipts" | "pnl";
const TABS: Tab[] = ["overview", "payments", "expenses", "unpaid", "receipts", "pnl"];
export const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), "MMM"));
const LIVE = ["confirmed", "checked_in", "checked_out"];

export function signed(p: Payment) {
  return p.kind === "refund" ? -p.amount : p.amount;
}

/** Payments and expenses from `from` (or Jan 1) to Dec 31 of `year`. Shared with Reports. */
export function useYearBooks(year: number, from?: string) {
  const yearFrom = from && from < `${year}-01-01` ? from : `${year}-01-01`;
  const yearTo = `${year}-12-31`;
  const payments = useQuery({
    queryKey: ["payments", "year", yearFrom, yearTo],
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, booking:bookings(ref, unit_id, source, guest:guests(full_name))")
        .gte("paid_on", yearFrom)
        .lte("paid_on", yearTo)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) as PaymentRow[];
    },
  });
  const expenses = useQuery({
    queryKey: ["expenses", "year", yearFrom, yearTo],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("spent_on", yearFrom)
        .lte("spent_on", yearTo)
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })) as Expense[];
    },
  });
  return { payments, expenses };
}

/** Balances still owed, by how long past the stay's end. */
export const AGING = [
  { key: "upcoming", label: "Stay not over yet" },
  { key: "0-30", label: "0–30 days after checkout" },
  { key: "31-60", label: "31–60 days" },
  { key: "60+", label: "Over 60 days" },
] as const;
export type AgingKey = (typeof AGING)[number]["key"];
export function agingOf(b: BookingSummary, today: string): AgingKey {
  if (b.check_out > today) return "upcoming";
  const days = differenceInCalendarDays(new Date(`${today}T00:00:00`), new Date(`${b.check_out}T00:00:00`));
  return days <= 30 ? "0-30" : days <= 60 ? "31-60" : "60+";
}

export default function Finance() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const range = useAdminRange();
  const year = Number(range.to.slice(0, 4));
  const today = isoDate(new Date());
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "overview";
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    setParams(next, { replace: true });
    clearFilters();
  };
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [attaching, setAttaching] = useState<PaymentRow | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);

  const { payments: pq, expenses: eq } = useYearBooks(year, range.from);
  const payments = pq.data;
  const expenses = eq.data;
  const { data: bookings } = useAllBookings();
  const { data: units } = useUnits();
  const loading = pq.isLoading || eq.isLoading;

  const inPeriod = (iso: string) => iso >= range.from && iso <= range.to;
  const periodPayments = useMemo(() => (payments ?? []).filter((p) => inPeriod(p.paid_on)), [payments, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const periodExpenses = useMemo(() => (expenses ?? []).filter((e) => inPeriod(e.spent_on)), [expenses, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const income = periodPayments.reduce((s, p) => s + signed(p), 0);
  const spent = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const net = income - spent;
  const margin = income > 0 ? Math.round((net / income) * 100) : null;

  const unpaid = useMemo(
    () =>
      (bookings ?? [])
        .filter((b) => LIVE.includes(b.status) && b.balance > 0.009)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [bookings],
  );
  const receivable = unpaid.reduce((s, b) => s + b.balance, 0);

  // ── filters for the lists ──
  const [fq, setFq] = useState("");
  const [method, setMethod] = useState<"any" | PaymentMethod>("any");
  const [kind, setKind] = useState<"any" | "payment" | "refund">("any");
  const [category, setCategory] = useState("any");
  const [room, setRoom] = useState("any");
  const [aging, setAging] = useState<"any" | AgingKey>("any");
  const [hasReceipt, setHasReceipt] = useState<"any" | "yes" | "no">("any");
  function clearFilters() {
    setFq("");
    setMethod("any");
    setKind("any");
    setCategory("any");
    setRoom("any");
    setAging("any");
    setHasReceipt("any");
  }
  const term = fq.trim().toLowerCase();
  const has = (...vals: (string | null | undefined)[]) => !term || vals.some((v) => v?.toLowerCase().includes(term));
  const receiptOk = (path: string | null | undefined) => hasReceipt === "any" || (hasReceipt === "yes") === Boolean(path);
  const shownPayments = periodPayments.filter(
    (p) =>
      (method === "any" || p.method === method) &&
      (kind === "any" || p.kind === kind) &&
      (room === "any" || p.booking?.unit_id === room) &&
      receiptOk(p.receipt_path) &&
      has(p.booking?.guest?.full_name, p.booking?.ref, p.reference, p.notes),
  );
  const shownExpenses = periodExpenses.filter(
    (e) => (category === "any" || e.category === category) && receiptOk(e.receipt_path) && has(e.description, e.vendor, e.notes),
  );
  const shownUnpaid = unpaid.filter(
    (b) =>
      (room === "any" || b.unit_id === room) &&
      (aging === "any" || agingOf(b, today) === aging) &&
      has(b.guest_name, b.ref, b.guest_phone, b.unit_name),
  );
  const filterKey = [term, method, kind, category, room, aging, hasReceipt, range.from, range.to];
  const pagedPayments = usePaged(shownPayments, filterKey);
  const pagedExpenses = usePaged(shownExpenses, filterKey);
  const pagedUnpaid = usePaged(shownUnpaid, filterKey);
  const filtering =
    fq !== "" || method !== "any" || kind !== "any" || category !== "any" || room !== "any" || aging !== "any" || hasReceipt !== "any";
  const manyRooms = (units?.length ?? 0) > 1;

  // ── receipts, all kinds, for the period ──
  const receipts = useMemo(() => {
    const out: ReceiptItem[] = [];
    periodExpenses.forEach((e) =>
      out.push({
        key: `e${e.id}`,
        type: "expense",
        path: e.receipt_path ?? null,
        title: e.description,
        sub: `${categoryLabel(e.category)}${e.vendor ? ` · ${e.vendor}` : ""}`,
        amount: e.amount,
        date: e.spent_on,
        onEdit: () => setEditing(e),
      }),
    );
    periodPayments.forEach((p) =>
      out.push({
        key: `p${p.id}`,
        type: "payment",
        path: p.receipt_path ?? null,
        title: p.booking?.guest?.full_name ?? "Payment",
        sub: `${p.booking?.ref ?? ""} · ${METHOD_LABEL[p.method]}${p.kind === "refund" ? " · refund" : ""}`,
        amount: signed(p),
        date: p.paid_on,
        onEdit: () => setAttaching(p),
      }),
    );
    (bookings ?? [])
      .filter((b) => b.receipt_path && inPeriod(b.created_at.slice(0, 10)))
      .forEach((b) =>
        out.push({
          key: `b${b.id}`,
          type: "guest",
          path: b.receipt_path,
          title: b.guest_name,
          sub: `${b.ref} · sent with the booking`,
          amount: null,
          date: b.created_at.slice(0, 10),
          onEdit: () => setOpenBooking(b.id),
        }),
      );
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [periodExpenses, periodPayments, bookings]); // eslint-disable-line react-hooks/exhaustive-deps
  const withReceipt = receipts.filter((r) => r.path).length;
  const missingExpenseReceipts = periodExpenses.filter((e) => !e.receipt_path).length;

  async function deleteExpense(e: Expense) {
    const ok = await ask({
      title: `Delete “${e.description}”?`,
      description: `${money(e.amount)} on ${e.spent_on} comes off your expenses${e.receipt_path ? ", and its receipt is deleted too" : ""}.`,
      confirmLabel: `Delete ${money(e.amount)}`,
    });
    if (!ok) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) return toast.error(errorMessage(error));
    await removeReceipt(e.receipt_path);
    toast.success("Expense deleted");
    qc.invalidateQueries();
  }

  function exportCsv() {
    const stamp = range.from === range.to ? range.from : `${range.from}_${range.to}`;
    if (tab === "expenses")
      downloadCsv(`expenses-${stamp}.csv`, [
        ["Date", "Category", "Description", "Vendor", "Amount", "Receipt", "Notes"],
        ...shownExpenses.map((e) => [e.spent_on, categoryLabel(e.category), e.description, e.vendor, e.amount, e.receipt_path ? "Yes" : "No", e.notes]),
      ]);
    else if (tab === "unpaid")
      downloadCsv(`unpaid-${today}.csv`, [
        ["Booking", "Guest", "Phone", "Check-in", "Check-out", "Age", "Total", "Paid", "Balance"],
        ...shownUnpaid.map((b) => [
          b.ref,
          b.guest_name,
          b.guest_phone,
          b.check_in,
          b.check_out,
          AGING.find((a) => a.key === agingOf(b, today))?.label,
          b.total,
          b.paid,
          b.balance,
        ]),
      ]);
    else
      downloadCsv(`payments-${stamp}.csv`, [
        ["Date", "Type", "Amount", "Method", "Booking", "Guest", "Reference", "Receipt", "Notes"],
        ...shownPayments.map((p) => [
          p.paid_on,
          p.kind,
          signed(p),
          METHOD_LABEL[p.method],
          p.booking?.ref,
          p.booking?.guest?.full_name,
          p.reference,
          p.receipt_path ? "Yes" : "No",
          p.notes,
        ]),
      ]);
  }

  return (
    <>
      <PageHeader
        title="Finance"
        description={`${range.label}. Income is money received (by payment date); expenses are what you record here. Change the dates in the top bar.`}
        actions={
          <>
            <Link
              to="/admin/reports"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm font-medium text-ink shadow-[0_1px_0_var(--color-sand-300)] hover:bg-sand-100"
            >
              <FileText className="size-4" /> Reports & PDF
            </Link>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add expense
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatTile label={`Income · ${range.name}`} value={money(income, true)} sub={plural(periodPayments.length, "payment")} />
        <StatTile label="Expenses" value={money(spent, true)} sub={plural(periodExpenses.length, "expense")} />
        <StatTile
          label="Net profit"
          value={money(net, true)}
          tone={net < 0 ? "warn" : "default"}
          sub={margin != null ? `${margin}% margin` : "No income yet"}
        />
        <button type="button" onClick={() => setTab("unpaid")} className="block cursor-pointer rounded-2xl text-left">
          <StatTile
            label="Unpaid balances"
            value={money(receivable, true)}
            tone={receivable > 0 ? "warn" : "default"}
            sub={`${plural(unpaid.length, "booking")} · all dates`}
          />
        </button>
      </StatGrid>

      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "overview", label: "Overview" },
            { value: "payments", label: "Payments", count: periodPayments.length },
            { value: "expenses", label: "Expenses", count: periodExpenses.length },
            { value: "unpaid", label: "Unpaid", count: unpaid.length, waiting: true },
            { value: "receipts", label: "Receipts", count: withReceipt },
            { value: "pnl", label: `P&L ${year}` },
          ]}
        />
        {(tab === "payments" || tab === "expenses" || tab === "unpaid") && (
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
        )}
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : tab === "overview" ? (
        <Overview
          year={year}
          payments={payments ?? []}
          expenses={expenses ?? []}
          periodPayments={periodPayments}
          periodExpenses={periodExpenses}
          unpaid={unpaid}
          today={today}
          from={range.from}
          to={range.to}
          periodName={range.name}
          onAging={(k) => {
            setTab("unpaid");
            setAging(k);
          }}
        />
      ) : tab === "pnl" ? (
        <PnlTable year={year} payments={payments ?? []} expenses={expenses ?? []} />
      ) : tab === "receipts" ? (
        <ReceiptsTab
          items={receipts}
          missingExpenses={missingExpenseReceipts}
          onMissing={() => {
            setTab("expenses");
            setHasReceipt("no");
          }}
        />
      ) : (
        <>
          <ToolbarGroup className="mb-3">
            <SearchField
              value={fq}
              onChange={setFq}
              placeholder={tab === "payments" ? "Search guest, ref, reference" : tab === "expenses" ? "Search description, vendor" : "Search guest, ref, phone"}
            />
            {tab === "payments" && (
              <>
                <FilterSelect
                  label="Method"
                  value={method}
                  onChange={setMethod}
                  options={[
                    { value: "any" as const, label: "All methods" },
                    ...(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((k) => ({ value: k, label: METHOD_LABEL[k] })),
                  ]}
                />
                <FilterSelect
                  label="Type"
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: "any", label: "Payments & refunds" },
                    { value: "payment", label: "Payments only" },
                    { value: "refund", label: "Refunds only" },
                  ]}
                />
              </>
            )}
            {tab === "expenses" && (
              <FilterSelect
                label="Category"
                value={category}
                onChange={setCategory}
                options={[{ value: "any", label: "All categories" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]}
              />
            )}
            {tab !== "unpaid" && (
              <FilterSelect
                label="Receipt"
                value={hasReceipt}
                onChange={setHasReceipt}
                options={[
                  { value: "any", label: "With or without receipt" },
                  { value: "yes", label: "Has a receipt" },
                  { value: "no", label: "No receipt yet" },
                ]}
              />
            )}
            {tab === "unpaid" && (
              <FilterSelect
                label="Age"
                value={aging}
                onChange={setAging}
                options={[{ value: "any" as const, label: "Any age" }, ...AGING.map((a) => ({ value: a.key, label: a.label }))]}
              />
            )}
            {tab !== "expenses" && manyRooms && (
              <FilterSelect
                label="Room"
                value={room}
                onChange={setRoom}
                options={[{ value: "any", label: "All rooms" }, ...(units ?? []).map((u) => ({ value: u.id, label: u.name }))]}
              />
            )}
            <ClearFilters active={filtering} onClear={clearFilters} />
          </ToolbarGroup>

          <Card className="overflow-hidden">
            {tab === "payments" &&
              (shownPayments.length === 0 ? (
                <EmptyState icon={<Receipt className="size-8" />} title={filtering ? "No matches" : "No payments in this period"}>
                  {filtering ? undefined : "Record payments from a booking's detail panel."}
                </EmptyState>
              ) : (
                <>
                  <table className="admin-table w-full text-sm">
                    <thead className="text-left text-xs text-ink-muted">
                      <tr className="border-b border-sand-200">
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium">Guest</th>
                        <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Method</th>
                        <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                        <th className="px-4 py-2.5 text-center font-medium">Receipt</th>
                        <th className="w-24 px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-200">
                      {pagedPayments.items.map((p) => (
                        <tr key={p.id} className="cursor-pointer hover:bg-sand-50" onClick={() => setOpenBooking(p.booking_id)}>
                          <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{prettyDate(p.paid_on, "MMM d")}</td>
                          <td className="px-4 py-2.5">
                            <p>{p.booking?.guest?.full_name ?? "—"}</p>
                            <p className="font-mono text-xs text-ink-muted">{p.booking?.ref}</p>
                          </td>
                          <td className="hidden px-4 py-2.5 text-ink-soft sm:table-cell">
                            {METHOD_LABEL[p.method as PaymentMethod]}
                            {p.reference && <span className="block text-xs text-ink-muted">Ref {p.reference}</span>}
                          </td>
                          <td className={cn("px-4 py-2.5 text-right tabular-nums", p.kind === "refund" && "text-red-700")}>
                            {p.kind === "refund" ? "−" : ""}
                            {money(p.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <ReceiptCell path={p.receipt_path} onAttach={() => setAttaching(p)} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <ViewButton onClick={() => setOpenBooking(p.booking_id)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination paged={pagedPayments} noun="payment" />
                </>
              ))}

            {tab === "expenses" &&
              (shownExpenses.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="size-8" />}
                  title={filtering ? "No matches" : "No expenses in this period"}
                  action={
                    !filtering && (
                      <Button size="sm" onClick={() => setEditing("new")}>
                        <Plus className="size-4" /> Add expense
                      </Button>
                    )
                  }
                >
                  {filtering ? undefined : "Record bills, salaries and supplies to see your real profit."}
                </EmptyState>
              ) : (
                <>
                  <table className="admin-table w-full text-sm">
                    <thead className="text-left text-xs text-ink-muted">
                      <tr className="border-b border-sand-200">
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium">Expense</th>
                        <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                        <th className="px-4 py-2.5 text-center font-medium">Receipt</th>
                        <th className="w-24 px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-200">
                      {pagedExpenses.items.map((e) => (
                        <tr key={e.id}>
                          <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{prettyDate(e.spent_on, "MMM d")}</td>
                          <td className="px-4 py-2.5">
                            <p>{e.description}</p>
                            <p className="text-xs text-ink-muted">
                              {categoryLabel(e.category)}
                              {e.vendor && ` · ${e.vendor}`}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{money(e.amount)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <ReceiptCell path={e.receipt_path} onAttach={() => setEditing(e)} />
                          </td>
                          <td className="px-2 py-2.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => setEditing(e)}
                              className="cursor-pointer rounded p-1 text-ink-muted hover:bg-sand-100 hover:text-ink"
                              aria-label="Edit expense"
                              title="Edit expense"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => deleteExpense(e)}
                              className="cursor-pointer rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-700"
                              aria-label="Delete expense"
                              title="Delete expense"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination paged={pagedExpenses} noun="expense" />
                </>
              ))}

            {tab === "unpaid" &&
              (shownUnpaid.length === 0 ? (
                <EmptyState title={filtering ? "No matches" : "Everyone's paid up"} />
              ) : (
                <>
                  <table className="admin-table w-full text-sm">
                    <thead className="text-left text-xs text-ink-muted">
                      <tr className="border-b border-sand-200">
                        <th className="px-4 py-2.5 font-medium">Stay</th>
                        <th className="px-4 py-2.5 font-medium">Guest</th>
                        <th className="hidden px-4 py-2.5 font-medium md:table-cell">Age</th>
                        <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Paid</th>
                        <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                        <th className="w-24 px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-200">
                      {pagedUnpaid.items.map((b) => {
                        const age = agingOf(b, today);
                        return (
                          <tr key={b.id} className="cursor-pointer hover:bg-sand-50" onClick={() => setOpenBooking(b.id)}>
                            <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{stayRange(b.check_in, b.check_out)}</td>
                            <td className="px-4 py-2.5">
                              <p>{b.guest_name}</p>
                              <p className="font-mono text-xs text-ink-muted">
                                {b.ref}
                                {b.guest_phone && ` · ${b.guest_phone}`}
                              </p>
                            </td>
                            <td className="hidden px-4 py-2.5 md:table-cell">
                              <Badge className={cn(age === "60+" && "bg-red-50 text-red-700", age === "31-60" && "bg-amber-50 text-amber-800")}>
                                {AGING.find((a) => a.key === age)?.label}
                              </Badge>
                            </td>
                            <td className="hidden px-4 py-2.5 text-right text-ink-muted tabular-nums sm:table-cell">
                              {money(b.paid)} of {money(b.total)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-terra-600 tabular-nums">{money(b.balance)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <ViewButton onClick={() => setOpenBooking(b.id)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pagination paged={pagedUnpaid} noun="booking" />
                </>
              ))}
          </Card>
        </>
      )}

      {editing && <ExpenseModal expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {attaching && <AttachPaymentReceipt payment={attaching} onClose={() => setAttaching(null)} />}
      <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />
    </>
  );
}

// ───────────────────────── overview ─────────────────────────

/** Sum `val` by `key`, as label/value rows sorted biggest first, zeros dropped. */
export function shareBy<T>(list: T[], key: (t: T) => string, val: (t: T) => number, label: (k: string) => string) {
  const m = new Map<string, number>();
  list.forEach((t) => m.set(key(t), (m.get(key(t)) ?? 0) + val(t)));
  return [...m.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: label(k), value: v }))
    .sort((a, b) => b.value - a.value);
}

function Overview({
  year,
  payments,
  expenses,
  periodPayments,
  periodExpenses,
  unpaid,
  today,
  from,
  to,
  periodName,
  onAging,
}: {
  year: number;
  payments: PaymentRow[];
  expenses: Expense[];
  periodPayments: PaymentRow[];
  periodExpenses: Expense[];
  unpaid: BookingSummary[];
  today: string;
  from: string;
  to: string;
  periodName: string;
  onAging: (k: AgingKey) => void;
}) {
  const monthly = useMemo(() => monthlyBooks(year, payments, expenses), [year, payments, expenses]);
  const netByMonth = monthly.map((m) => ({ label: m.label, net: m.income - m.expenses }));

  const daily = useMemo(() => {
    const days = eachDayOfInterval({ start: new Date(`${from}T00:00:00`), end: new Date(`${to}T00:00:00`) });
    const byDay = new Map<string, number>();
    periodPayments.forEach((p) => byDay.set(p.paid_on, (byDay.get(p.paid_on) ?? 0) + signed(p)));
    return days.map((d) => ({ label: format(d, "MMM d"), value: byDay.get(isoDate(d)) ?? 0 }));
  }, [periodPayments, from, to]);

  const byCategory = shareBy(periodExpenses, (e) => e.category, (e) => e.amount, categoryLabel);
  const byMethod = shareBy(periodPayments, (p) => p.method, signed, (k) => METHOD_LABEL[k as PaymentMethod] ?? k);
  const bySource = shareBy(periodPayments, (p) => p.booking?.source ?? "other", signed, (k) => SOURCE_LABEL[k as BookingSource] ?? k);
  const aging = AGING.map((a) => {
    const rows = unpaid.filter((b) => agingOf(b, today) === a.key);
    return { key: a.key, label: a.label, value: rows.reduce((s, b) => s + b.balance, 0), count: rows.length };
  });
  const agingMax = Math.max(...aging.map((x) => x.value), 1);
  const bestMonth = [...monthly].sort((a, b) => b.income - a.income)[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title={`Income vs expenses · ${year}`}
          description={bestMonth?.income ? `Best month: ${bestMonth.label}, ${money(bestMonth.income, true)}` : undefined}
          chart={<IncomeExpenseChart data={monthly} />}
          table={
            <MiniTable
              head={["Month", "Income", "Expenses", "Net"]}
              rows={monthly.map((m) => [m.label, money(m.income, true), money(m.expenses, true), money(m.income - m.expenses, true)])}
            />
          }
        />
        <ChartCard
          title="Net profit by month"
          description="Brown is profit, terra a loss"
          chart={<NetBars data={netByMonth} />}
          table={<MiniTable head={["Month", "Net"]} rows={netByMonth.map((m) => [m.label, money(m.net, true)])} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title={`Money in, day by day · ${periodName}`}
          description={`${money(daily.reduce((s, d) => s + d.value, 0), true)} over ${plural(daily.length, "day")}`}
          chart={<DailyArea data={daily} />}
          table={<MiniTable head={["Day", "Collected"]} rows={daily.filter((d) => d.value !== 0).map((d) => [d.label, money(d.value, true)])} />}
        />
        <Card>
          <CardHeader title="Where the money went" description={periodName} />
          <div className="p-5">
            <ShareBars rows={byCategory} color={SERIES.expenses} empty="No expenses recorded." />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="How guests paid" description={periodName} />
          <div className="p-5">
            <ShareBars rows={byMethod} color={SERIES.income} empty="No payments yet." />
          </div>
        </Card>
        <Card>
          <CardHeader title="Income by booking source" description="Where the paying guests came from" />
          <div className="p-5">
            <ShareBars rows={bySource} color={SERIES.income} empty="No payments yet." />
          </div>
        </Card>
        <Card>
          <CardHeader title="Who still owes, by age" description={`${money(aging.reduce((s, a) => s + a.value, 0), true)} · all dates`} />
          <ul className="space-y-3 p-5">
            {aging.map((a, i) => (
              <li key={a.key}>
                <button type="button" onClick={() => onAging(a.key)} className="block w-full cursor-pointer text-left" title={`Show: ${a.label}`}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="text-ink-soft">{a.label}</span>
                    <span className="tabular-nums">
                      {money(a.value, true)} <span className="text-xs text-ink-muted">· {a.count}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-sand-100">
                    {/* Older debt is darker: one hue, light to dark. */}
                    <div className="h-2 rounded-full" style={{ width: `${(a.value / agingMax) * 100}%`, background: AGING_RAMP[i] }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/** Sequential terra ramp for debt age, light (recent) to dark (old). */
const AGING_RAMP = ["#d9b99c", "#c08860", "#a4471f", "#7a2f12"];

export function monthlyBooks(year: number, payments: Payment[], expenses: Expense[]): MonthPoint[] {
  const pts = MONTHS.map((label) => ({ label, income: 0, expenses: 0 }));
  const ofYear = (iso: string) => iso.startsWith(String(year));
  payments.filter((p) => ofYear(p.paid_on)).forEach((p) => (pts[Number(p.paid_on.slice(5, 7)) - 1].income += signed(p)));
  expenses.filter((e) => ofYear(e.spent_on)).forEach((e) => (pts[Number(e.spent_on.slice(5, 7)) - 1].expenses += e.amount));
  return pts;
}

function ChartCard({
  title,
  description,
  chart,
  table,
  className,
}: {
  title: string;
  description?: string;
  chart: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        action={
          <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)}>
            {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
            {asTable ? "Chart" : "Table"}
          </Button>
        }
      />
      <div className="p-4">{asTable ? <div className="max-h-64 overflow-y-auto">{table}</div> : chart}</div>
    </Card>
  );
}

function MiniTable({ head, rows }: { head: string[]; rows: string[][] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-muted">Nothing to show.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-ink-muted">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={cn("py-1.5 font-medium", i > 0 && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-sand-200 tabular-nums">
        {rows.map((r) => (
          <tr key={r[0]}>
            {r.map((c, i) => (
              <td key={i} className={cn("py-1.5", i > 0 && "text-right")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ───────────────────────── P&L ─────────────────────────

/** The year by month, cash basis. Shared with Reports. */
export function pnlRows(year: number, payments: Payment[], expenses: Expense[]) {
  const ofYear = (iso: string) => iso.startsWith(String(year));
  const m = (iso: string) => Number(iso.slice(5, 7)) - 1;
  const zero = () => Array(12).fill(0) as number[];
  const received = zero();
  const refunds = zero();
  payments
    .filter((p) => ofYear(p.paid_on))
    .forEach((p) => {
      if (p.kind === "refund") refunds[m(p.paid_on)] += p.amount;
      else received[m(p.paid_on)] += p.amount;
    });
  const cats = new Map<string, number[]>();
  expenses
    .filter((e) => ofYear(e.spent_on))
    .forEach((e) => {
      if (!cats.has(e.category)) cats.set(e.category, zero());
      cats.get(e.category)![m(e.spent_on)] += e.amount;
    });
  const income = received.map((v, i) => v - refunds[i]);
  const totalExp = zero().map((_, i) => [...cats.values()].reduce((s, row) => s + row[i], 0));
  const net = income.map((v, i) => v - totalExp[i]);
  const categories: { label: string; values: number[] }[] = EXPENSE_CATEGORIES.filter((c) => cats.has(c.value)).map((c) => ({
    label: c.label,
    values: cats.get(c.value)!,
  }));
  // A category no longer in the list still counts.
  [...cats.keys()]
    .filter((k) => !EXPENSE_CATEGORIES.some((c) => c.value === k))
    .forEach((k) => categories.push({ label: categoryLabel(k), values: cats.get(k)! }));
  return { received, refunds, income, categories, totalExp, net };
}

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

function PnlRow({ label, values, style }: { label: string; values: number[]; style?: "total" | "net" | "sub" }) {
  const bg = style === "net" ? "bg-brand-50" : style === "total" ? "bg-sand-50" : "bg-white";
  return (
    <tr className={cn(bg, style === "total" && "font-medium", style === "net" && "font-semibold")}>
      <th scope="row" className={cn("sticky left-0 px-4 py-2 text-left font-[inherit] whitespace-nowrap", bg, style === "sub" && "pl-8 text-ink-soft")}>
        {label}
      </th>
      {values.map((v, i) => (
        <td key={i} className={cn("px-3 py-2 text-right tabular-nums", v < 0 && "text-terra-600", v === 0 && "text-ink-muted/60")}>
          {v === 0 ? "—" : money(v, true)}
        </td>
      ))}
      <td className={cn("px-4 py-2 text-right font-semibold tabular-nums", sum(values) < 0 && "text-terra-600")}>{money(sum(values), true)}</td>
    </tr>
  );
}

function PnlTable({ year, payments, expenses }: { year: number; payments: Payment[]; expenses: Expense[] }) {
  const r = pnlRows(year, payments, expenses);
  function exportPnl() {
    downloadCsv(`pnl-${year}.csv`, [
      ["", ...MONTHS, "Total"],
      ["Payments received", ...r.received, sum(r.received)],
      ["Refunds", ...r.refunds.map((v) => -v), -sum(r.refunds)],
      ["Income", ...r.income, sum(r.income)],
      ...r.categories.map((c) => [c.label, ...c.values, sum(c.values)]),
      ["Total expenses", ...r.totalExp, sum(r.totalExp)],
      ["Net profit", ...r.net, sum(r.net)],
    ]);
  }
  const totalIncome = sum(r.income);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={`Profit & loss · ${year}`}
        description={
          totalIncome > 0
            ? `${Math.round((sum(r.net) / totalIncome) * 100)}% margin for the year so far. Cash basis: money in by payment date.`
            : "Cash basis: money in by payment date, expenses by the date spent."
        }
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportPnl}>
              <Download className="size-4" /> CSV
            </Button>
            <Link
              to="/admin/reports?preset=pnl"
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-sand-300 bg-white px-3 text-sm font-medium shadow-[0_1px_0_var(--color-sand-300)] hover:bg-sand-100"
            >
              <FileText className="size-4" /> PDF
            </Link>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="text-xs text-ink-muted">
            <tr className="border-b border-sand-200">
              <th className="sticky left-0 bg-white px-4 py-2.5 text-left font-medium">
                <span className="sr-only">Line</span>
              </th>
              {MONTHS.map((mo) => (
                <th key={mo} className="px-3 py-2.5 text-right font-medium">
                  {mo}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200/80">
            <PnlRow label="Payments received" values={r.received} style="sub" />
            <PnlRow label="Refunds" values={r.refunds.map((v) => -v)} style="sub" />
            <PnlRow label="Income" values={r.income} style="total" />
            {r.categories.map((c) => (
              <PnlRow key={c.label} label={c.label} values={c.values} style="sub" />
            ))}
            <PnlRow label="Total expenses" values={r.totalExp} style="total" />
            <PnlRow label="Net profit" values={r.net} style="net" />
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ───────────────────────── receipts ─────────────────────────

interface ReceiptItem {
  key: string;
  type: "expense" | "payment" | "guest";
  path: string | null;
  title: string;
  sub: string;
  amount: number | null;
  date: string;
  onEdit: () => void;
}
const TYPE_LABEL: Record<ReceiptItem["type"], string> = { expense: "Expense", payment: "Payment", guest: "Guest upload" };

function ReceiptsTab({ items, missingExpenses, onMissing }: { items: ReceiptItem[]; missingExpenses: number; onMissing: () => void }) {
  const [type, setType] = useState<"any" | ReceiptItem["type"]>("any");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = items.filter(
    (r) => r.path && (type === "any" || r.type === type) && (!term || [r.title, r.sub].some((v) => v.toLowerCase().includes(term))),
  );
  const paged = usePaged(shown, [type, term], 25);
  return (
    <>
      <ToolbarGroup className="mb-3">
        <SearchField value={q} onChange={setQ} placeholder="Search guest, expense, ref" />
        <FilterSelect
          label="Kind"
          value={type}
          onChange={setType}
          options={[
            { value: "any", label: "All receipts" },
            { value: "expense", label: "Expenses" },
            { value: "payment", label: "Payments" },
            { value: "guest", label: "Guest uploads" },
          ]}
        />
        {missingExpenses > 0 && (
          <button
            type="button"
            onClick={onMissing}
            className="inline-flex h-[42px] cursor-pointer items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-4 text-sm text-amber-900 hover:bg-amber-100"
          >
            <ImageOff className="size-4" /> {plural(missingExpenses, "expense")} without a receipt
          </button>
        )}
      </ToolbarGroup>
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Paperclip />} title={term || type !== "any" ? "No matches" : "No receipts in this period"}>
            Attach a photo or PDF when you add an expense or record a payment. Receipts guests send with their booking show here too.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {paged.items.map((r) => (
              <ReceiptCard key={r.key} r={r} />
            ))}
          </div>
          <Card className="mt-4 overflow-hidden [&>div]:border-t-0">
            <Pagination paged={paged} noun="receipt" />
          </Card>
        </>
      )}
    </>
  );
}

function ReceiptCard({ r }: { r: ReceiptItem }) {
  const pdf = isPdf(r.path!);
  const { data: url } = useReceiptUrl(pdf ? null : r.path);
  return (
    <Card className="group overflow-hidden">
      <button
        type="button"
        onClick={() => openReceipt(r.path!).catch((e) => toast.error((e as Error).message))}
        className="block aspect-[4/5] w-full cursor-pointer overflow-hidden bg-sand-100"
        title="Open the receipt"
      >
        {pdf ? (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-sm text-ink-muted">
            <FileText className="size-8" /> PDF
          </span>
        ) : url ? (
          <img src={url} alt={`Receipt: ${r.title}`} className="size-full object-cover transition-transform group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <span className="block size-full animate-pulse bg-sand-200/60" />
        )}
      </button>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium" title={r.title}>
            {r.title}
          </p>
          {r.amount != null && <span className={cn("shrink-0 text-sm tabular-nums", r.amount < 0 && "text-red-700")}>{money(r.amount, true)}</span>}
        </div>
        <p className="truncate text-xs text-ink-muted" title={r.sub}>
          {r.sub}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge className={cn(r.type === "payment" && "bg-emerald-50 text-emerald-800", r.type === "guest" && "bg-sky-50 text-sky-800")}>
            {TYPE_LABEL[r.type]}
          </Badge>
          <span className="text-xs text-ink-muted">{prettyDate(r.date, "MMM d")}</span>
        </div>
        <button type="button" onClick={r.onEdit} className="mt-2 cursor-pointer text-xs text-brand-700 hover:underline">
          {r.type === "guest" ? "Open booking" : r.type === "payment" ? "Change receipt" : "Edit expense"}
        </button>
      </div>
    </Card>
  );
}

/** A paperclip that opens the receipt, or a quiet "Attach" when there is none. */
function ReceiptCell({ path, onAttach }: { path: string | null | undefined; onAttach: () => void }) {
  if (path)
    return (
      <button
        type="button"
        onClick={() => openReceipt(path).catch((e) => toast.error((e as Error).message))}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
        title="Open the receipt"
      >
        <Paperclip className="size-3.5" /> View
      </button>
    );
  return (
    <button
      type="button"
      onClick={onAttach}
      className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-muted hover:bg-sand-100 hover:text-ink"
      title="Attach a receipt"
    >
      <Plus className="size-3.5" /> Attach
    </button>
  );
}

function AttachPaymentReceipt({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
  const qc = useQueryClient();
  const original = payment.receipt_path ?? null;
  const [path, setPath] = useState<string | null>(original);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setSaving(true);
    const { error } = await supabase.from("payments").update({ receipt_path: path }).eq("id", payment.id);
    setSaving(false);
    if (error) return setError(receiptColumnMissing(errorMessage(error)));
    if (original && original !== path) await removeReceipt(original);
    toast.success(path ? "Receipt saved" : "Receipt removed");
    qc.invalidateQueries();
    onClose();
  }
  function cancel() {
    if (path && path !== original) removeReceipt(path);
    onClose();
  }
  return (
    <Modal
      open
      size="sm"
      onClose={cancel}
      title="Payment receipt"
      description={`${payment.booking?.guest?.full_name ?? "Payment"} · ${money(payment.amount)} · ${prettyDate(payment.paid_on)}`}
      footer={
        <>
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={busy || path === original}>
            Save
          </Button>
        </>
      }
    >
      <ReceiptField value={path} onChange={setPath} folder="payments" onBusy={setBusy} />
      <ErrorBox className="mt-3">{error}</ErrorBox>
    </Modal>
  );
}

// ───────────────────────── expense form ─────────────────────────

function ExpenseModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? isoDate(new Date()));
  const [category, setCategory] = useState(expense?.category ?? "utilities");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const original = expense?.receipt_path ?? null;
  const [receipt, setReceipt] = useState<string | null>(original);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return setError("Describe the expense.");
    if (!(Number(amount) > 0)) return setError("Enter an amount above zero.");
    setSaving(true);
    const row = {
      spent_on: spentOn,
      category,
      description: description.trim(),
      amount: Number(amount),
      vendor: vendor.trim(),
      notes: notes.trim(),
      // Only sent when it changes, so expenses still save before the receipts SQL is run.
      ...(receipt !== original ? { receipt_path: receipt } : {}),
    };
    const { error } = expense
      ? await supabase.from("expenses").update(row).eq("id", expense.id)
      : await supabase.from("expenses").insert(row);
    setSaving(false);
    if (error) return setError(receiptColumnMissing(errorMessage(error)));
    if (original && original !== receipt) await removeReceipt(original);
    toast.success(expense ? "Expense updated" : "Expense added");
    qc.invalidateQueries();
    onClose();
  }
  function cancel() {
    if (receipt && receipt !== original) removeReceipt(receipt);
    onClose();
  }

  return (
    <Modal
      open
      onClose={cancel}
      size="sm"
      title={expense ? "Edit expense" : "Add expense"}
      footer={
        <>
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={saving} disabled={uploading}>
            Save
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={save} className="space-y-4">
        <Field label="What was it for?">
          {(id) => (
            <Input
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Meralco bill — September"
              autoFocus={!expense}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₱)">
            {(id) => <Input id={id} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label="Date">
            {(id) => <Input id={id} type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />}
          </Field>
        </div>
        <Field label="Category">
          {(id) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Paid to" optional>
          {(id) => <Input id={id} value={vendor} onChange={(e) => setVendor(e.target.value)} />}
        </Field>
        <Field label="Notes" optional>
          {(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">
            Receipt <span className="font-normal text-ink-muted">(optional)</span>
          </p>
          <ReceiptField value={receipt} onChange={setReceipt} folder="expenses" onBusy={setUploading} />
        </div>
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}
