import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Download, Pencil, Plus, Receipt, Table2, BarChart3, Trash2 } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { downloadCsv, isoDate, money, prettyDate } from "../../lib/format";
import {
  EXPENSE_CATEGORIES,
  METHOD_LABEL,
  categoryLabel,
  type Expense,
  type Payment,
  type PaymentMethod,
} from "../../lib/types";
import { useUnits } from "../../lib/queries";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
} from "../../components/ui";
import { IncomeExpenseChart, SERIES, ShareBars, type MonthPoint } from "../../components/admin/Charts";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { useAllBookings } from "./Bookings";

interface PaymentRow extends Payment {
  booking: { ref: string; unit_id: string; guest: { full_name: string } | null } | null;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), "MMM"));

function signed(p: Payment) {
  return p.kind === "refund" ? -p.amount : p.amount;
}

export default function Finance() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "all">(now.getMonth());
  const [tab, setTab] = useState<"payments" | "expenses" | "unpaid">("payments");
  const [asTable, setAsTable] = useState(false);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);

  const yearFrom = `${year}-01-01`;
  const yearTo = `${year}-12-31`;

  const { data: payments, isLoading: loadingP } = useQuery({
    queryKey: ["payments", "year", year],
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, booking:bookings(ref, unit_id, guest:guests(full_name))")
        .gte("paid_on", yearFrom)
        .lte("paid_on", yearTo)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) as PaymentRow[];
    },
  });
  const { data: expenses, isLoading: loadingE } = useQuery({
    queryKey: ["expenses", "year", year],
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
  const { data: bookings } = useAllBookings();
  const { data: units } = useUnits();

  const inPeriod = (iso: string) => month === "all" || Number(iso.slice(5, 7)) - 1 === month;
  const periodPayments = useMemo(() => (payments ?? []).filter((p) => inPeriod(p.paid_on)), [payments, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const periodExpenses = useMemo(() => (expenses ?? []).filter((e) => inPeriod(e.spent_on)), [expenses, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const income = periodPayments.reduce((s, p) => s + signed(p), 0);
  const spent = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const net = income - spent;
  const margin = income > 0 ? Math.round((net / income) * 100) : null;

  const unpaid = useMemo(
    () =>
      (bookings ?? [])
        .filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status) && b.balance > 0.009)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [bookings],
  );
  const receivable = unpaid.reduce((s, b) => s + b.balance, 0);

  const monthly: MonthPoint[] = useMemo(() => {
    const pts = MONTHS.map((label) => ({ label, income: 0, expenses: 0 }));
    (payments ?? []).forEach((p) => (pts[Number(p.paid_on.slice(5, 7)) - 1].income += signed(p)));
    (expenses ?? []).forEach((e) => (pts[Number(e.spent_on.slice(5, 7)) - 1].expenses += e.amount));
    return pts;
  }, [payments, expenses]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    periodExpenses.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return [...m.entries()].map(([k, v]) => ({ label: categoryLabel(k), value: v })).sort((a, b) => b.value - a.value);
  }, [periodExpenses]);

  const byRoom = useMemo(() => {
    const m = new Map<string, number>();
    periodPayments.forEach((p) => {
      const id = p.booking?.unit_id ?? "?";
      m.set(id, (m.get(id) ?? 0) + signed(p));
    });
    return [...m.entries()]
      .map(([id, v]) => ({ label: units?.find((u) => u.id === id)?.name ?? "Unknown", value: v }))
      .sort((a, b) => b.value - a.value);
  }, [periodPayments, units]);

  const periodLabel = month === "all" ? String(year) : format(new Date(year, month, 1), "MMMM yyyy");

  async function deleteExpense(e: Expense) {
    if (!confirm(`Delete "${e.description}" (${money(e.amount)})?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Expense deleted");
    qc.invalidateQueries();
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() + 1 - i);

  return (
    <>
      <PageHeader
        title="Finance"
        description="Income is money received (by payment date). Expenses are what you record here."
        actions={
          <>
            <Select value={month} onChange={(e) => setMonth(e.target.value === "all" ? "all" : Number(e.target.value))} className="w-36">
              <option value="all">Whole year</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {format(new Date(2024, i, 1), "MMMM")}
                </option>
              ))}
            </Select>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add expense
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Income · ${periodLabel}`} value={money(income)} />
        <Stat label="Expenses" value={money(spent)} />
        <Stat
          label="Net profit"
          value={money(net)}
          note={margin != null ? `${margin}% margin` : undefined}
          tone={net < 0 ? "bad" : "good"}
        />
        <Stat label="Unpaid balances (all time)" value={money(receivable)} note={`${unpaid.length} bookings`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={`Income vs expenses · ${year}`}
            action={
              <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)}>
                {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
                {asTable ? "Chart" : "Table"}
              </Button>
            }
          />
          <div className="p-5">
            {loadingP || loadingE ? (
              <Spinner />
            ) : asTable ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-ink-muted">
                    <tr>
                      <th className="py-1.5 font-medium">Month</th>
                      <th className="py-1.5 text-right font-medium">Income</th>
                      <th className="py-1.5 text-right font-medium">Expenses</th>
                      <th className="py-1.5 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-200 tabular-nums">
                    {monthly.map((m) => (
                      <tr key={m.label}>
                        <td className="py-1.5">{m.label}</td>
                        <td className="py-1.5 text-right">{money(m.income, true)}</td>
                        <td className="py-1.5 text-right">{money(m.expenses, true)}</td>
                        <td className={`py-1.5 text-right ${m.income - m.expenses < 0 ? "text-red-700" : ""}`}>
                          {money(m.income - m.expenses, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <IncomeExpenseChart data={monthly} />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Where the money went" description={periodLabel} />
          <div className="p-5">
            <ShareBars rows={byCategory} color={SERIES.expenses} empty="No expenses recorded." />
          </div>
        </Card>
      </div>

      {byRoom.length > 1 && (
        <Card className="mt-4">
          <CardHeader title="Income by room" description={periodLabel} />
          <div className="p-5">
            <ShareBars rows={byRoom} color={SERIES.income} empty="No income yet." />
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            className="border-b-0"
            items={[
              { value: "payments", label: "Payments", count: periodPayments.length },
              { value: "expenses", label: "Expenses", count: periodExpenses.length },
              { value: "unpaid", label: "Unpaid", count: unpaid.length },
            ]}
          />
          <Button
            variant="ghost"
            size="sm"
            className="mb-1.5"
            onClick={() => {
              const stamp = month === "all" ? String(year) : `${year}-${String(month + 1).padStart(2, "0")}`;
              if (tab === "payments")
                downloadCsv(`payments-${stamp}.csv`, [
                  ["Date", "Type", "Amount", "Method", "Booking", "Guest", "Reference", "Notes"],
                  ...periodPayments.map((p) => [
                    p.paid_on,
                    p.kind,
                    signed(p),
                    METHOD_LABEL[p.method],
                    p.booking?.ref,
                    p.booking?.guest?.full_name,
                    p.reference,
                    p.notes,
                  ]),
                ]);
              else if (tab === "expenses")
                downloadCsv(`expenses-${stamp}.csv`, [
                  ["Date", "Category", "Description", "Vendor", "Amount", "Notes"],
                  ...periodExpenses.map((e) => [e.spent_on, categoryLabel(e.category), e.description, e.vendor, e.amount, e.notes]),
                ]);
              else
                downloadCsv(`unpaid-${isoDate(new Date())}.csv`, [
                  ["Booking", "Guest", "Phone", "Check-in", "Total", "Paid", "Balance"],
                  ...unpaid.map((b) => [b.ref, b.guest_name, b.guest_phone, b.check_in, b.total, b.paid, b.balance]),
                ]);
            }}
          >
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
        <div className="border-t border-sand-200">
          {tab === "payments" &&
            (periodPayments.length === 0 ? (
              <EmptyState icon={<Receipt className="size-8" />} title="No payments in this period">
                Record payments from a booking's detail panel.
              </EmptyState>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-sand-200">
                  {periodPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:bg-sand-50"
                      onClick={() => setOpenBooking(p.booking_id)}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{prettyDate(p.paid_on, "MMM d")}</td>
                      <td className="px-4 py-2.5">
                        <p>{p.booking?.guest?.full_name ?? "—"}</p>
                        <p className="font-mono text-xs text-ink-muted">{p.booking?.ref}</p>
                      </td>
                      <td className="hidden px-4 py-2.5 text-ink-soft sm:table-cell">
                        {METHOD_LABEL[p.method as PaymentMethod]}
                        {p.reference && <span className="block text-xs text-ink-muted">Ref {p.reference}</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${p.kind === "refund" ? "text-red-700" : ""}`}>
                        {p.kind === "refund" ? "−" : ""}
                        {money(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          {tab === "expenses" &&
            (periodExpenses.length === 0 ? (
              <EmptyState
                icon={<Receipt className="size-8" />}
                title="No expenses in this period"
                action={
                  <Button size="sm" onClick={() => setEditing("new")}>
                    <Plus className="size-4" /> Add expense
                  </Button>
                }
              >
                Record bills, salaries and supplies to see your real profit.
              </EmptyState>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-sand-200">
                  {periodExpenses.map((e) => (
                    <tr key={e.id} className="group">
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{prettyDate(e.spent_on, "MMM d")}</td>
                      <td className="px-4 py-2.5">
                        <p>{e.description}</p>
                        <p className="text-xs text-ink-muted">
                          {categoryLabel(e.category)}
                          {e.vendor && ` · ${e.vendor}`}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(e.amount)}</td>
                      <td className="w-20 px-2 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditing(e)}
                          className="rounded p-1 text-ink-muted hover:bg-sand-100 hover:text-ink"
                          aria-label="Edit expense"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => deleteExpense(e)}
                          className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-700"
                          aria-label="Delete expense"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          {tab === "unpaid" &&
            (unpaid.length === 0 ? (
              <EmptyState title="Everyone's paid up" />
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-sand-200">
                  {unpaid.map((b) => (
                    <tr key={b.id} className="cursor-pointer hover:bg-sand-50" onClick={() => setOpenBooking(b.id)}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{prettyDate(b.check_in, "MMM d")}</td>
                      <td className="px-4 py-2.5">
                        <p>{b.guest_name}</p>
                        <p className="font-mono text-xs text-ink-muted">
                          {b.ref} · {b.unit_name}
                        </p>
                      </td>
                      <td className="hidden px-4 py-2.5 text-right text-ink-muted tabular-nums sm:table-cell">
                        {money(b.paid)} of {money(b.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-clay-600 tabular-nums">{money(b.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </Card>

      {editing && <ExpenseModal expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />
    </>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "bad";
}) {
  return (
    <Card className="p-4">
      <p className="truncate text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${tone === "bad" ? "text-red-700" : ""}`}>
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
    </Card>
  );
}

function ExpenseModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? isoDate(new Date()));
  const [category, setCategory] = useState(expense?.category ?? "utilities");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
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
    };
    const { error } = expense
      ? await supabase.from("expenses").update(row).eq("id", expense.id)
      : await supabase.from("expenses").insert(row);
    setSaving(false);
    if (error) return setError(errorMessage(error));
    toast.success(expense ? "Expense updated" : "Expense added");
    qc.invalidateQueries();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={expense ? "Edit expense" : "Add expense"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={saving}>
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
              autoFocus
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₱)">
            {(id) => (
              <Input id={id} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            )}
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
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}
