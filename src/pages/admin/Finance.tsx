import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Download, Pencil, Plus, Receipt, Table2, BarChart3, Trash2 } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { downloadCsv, isoDate, money, prettyDate } from "../../lib/format";
import { useAdminRange } from "../../lib/admin-range";
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
  ask,
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
  StatTile,
  Tabs,
  Toolbar,
  ToolbarGroup,
  usePaged,
  ViewButton,
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
  // The top bar's dates decide the period; the chart shows that period's year.
  const range = useAdminRange();
  const year = Number(range.to.slice(0, 4));
  const [tab, setTab] = useState<"payments" | "expenses" | "unpaid">("payments");
  const [asTable, setAsTable] = useState(false);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  // The list's own search and filters, under the tabs.
  const [fq, setFq] = useState("");
  const [method, setMethod] = useState<"any" | PaymentMethod>("any");
  const [kind, setKind] = useState<"any" | "payment" | "refund">("any");
  const [category, setCategory] = useState("any");
  const [room, setRoom] = useState("any");

  const yearFrom = range.from < `${year}-01-01` ? range.from : `${year}-01-01`;
  const yearTo = `${year}-12-31`;

  const { data: payments, isLoading: loadingP } = useQuery({
    queryKey: ["payments", "year", yearFrom, yearTo],
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
  const { data: bookings } = useAllBookings();
  const { data: units } = useUnits();

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
        .filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status) && b.balance > 0.009)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [bookings],
  );
  const receivable = unpaid.reduce((s, b) => s + b.balance, 0);

  const monthly: MonthPoint[] = useMemo(() => {
    const pts = MONTHS.map((label) => ({ label, income: 0, expenses: 0 }));
    const ofYear = (iso: string) => iso.startsWith(String(year));
    (payments ?? []).filter((p) => ofYear(p.paid_on)).forEach((p) => (pts[Number(p.paid_on.slice(5, 7)) - 1].income += signed(p)));
    (expenses ?? []).filter((e) => ofYear(e.spent_on)).forEach((e) => (pts[Number(e.spent_on.slice(5, 7)) - 1].expenses += e.amount));
    return pts;
  }, [payments, expenses, year]);

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

  const periodLabel = range.name;

  const term = fq.trim().toLowerCase();
  const has = (...vals: (string | null | undefined)[]) => !term || vals.some((v) => v?.toLowerCase().includes(term));
  const shownPayments = useMemo(
    () =>
      periodPayments.filter(
        (p) =>
          (method === "any" || p.method === method) &&
          (kind === "any" || p.kind === kind) &&
          (room === "any" || p.booking?.unit_id === room) &&
          has(p.booking?.guest?.full_name, p.booking?.ref, p.reference, p.notes),
      ),
    [periodPayments, method, kind, room, term], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shownExpenses = useMemo(
    () =>
      periodExpenses.filter(
        (e) => (category === "any" || e.category === category) && has(e.description, e.vendor, e.notes),
      ),
    [periodExpenses, category, term], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shownUnpaid = useMemo(
    () => unpaid.filter((b) => (room === "any" || b.unit_id === room) && has(b.guest_name, b.ref, b.guest_phone, b.unit_name)),
    [unpaid, room, term], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const pagedPayments = usePaged(shownPayments, [term, method, kind, room, range.from, range.to]);
  const pagedExpenses = usePaged(shownExpenses, [term, category, range.from, range.to]);
  const pagedUnpaid = usePaged(shownUnpaid, [term, room]);
  const filtering =
    fq !== "" ||
    (tab === "payments" && (method !== "any" || kind !== "any" || room !== "any")) ||
    (tab === "expenses" && category !== "any") ||
    (tab === "unpaid" && room !== "any");
  function clearFilters() {
    setFq("");
    setMethod("any");
    setKind("any");
    setCategory("any");
    setRoom("any");
  }
  const roomOptions = [{ value: "any", label: "All rooms" }, ...(units ?? []).map((u) => ({ value: u.id, label: u.name }))];

  async function deleteExpense(e: Expense) {
    const ok = await ask({
      title: `Delete “${e.description}”?`,
      description: `${money(e.amount)} on ${e.spent_on} comes off your expenses.`,
      confirmLabel: `Delete ${money(e.amount)}`,
    });
    if (!ok) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Expense deleted");
    qc.invalidateQueries();
  }


  return (
    <>
      <PageHeader
        title="Finance"
        description={`${range.label}. Income is money received (by payment date); expenses are what you record here. Change the dates in the top bar.`}
        actions={
          <>
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

      <Toolbar className="mt-6">
          <Tabs
            value={tab}
            onChange={(t) => {
              setTab(t);
              clearFilters();
            }}
            className="border-b-0"
            items={[
              { value: "payments", label: "Payments", count: periodPayments.length },
              { value: "expenses", label: "Expenses", count: periodExpenses.length },
              { value: "unpaid", label: "Unpaid", count: unpaid.length },
            ]}
          />
          <Button
            variant="secondary"
            onClick={() => {
              const stamp = range.from === range.to ? range.from : `${range.from}_${range.to}`;
              if (tab === "payments")
                downloadCsv(`payments-${stamp}.csv`, [
                  ["Date", "Type", "Amount", "Method", "Booking", "Guest", "Reference", "Notes"],
                  ...shownPayments.map((p) => [
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
                  ...shownExpenses.map((e) => [e.spent_on, categoryLabel(e.category), e.description, e.vendor, e.amount, e.notes]),
                ]);
              else
                downloadCsv(`unpaid-${isoDate(new Date())}.csv`, [
                  ["Booking", "Guest", "Phone", "Check-in", "Total", "Paid", "Balance"],
                  ...shownUnpaid.map((b) => [b.ref, b.guest_name, b.guest_phone, b.check_in, b.total, b.paid, b.balance]),
                ]);
            }}
          >
            <Download className="size-4" /> Export CSV
          </Button>
      </Toolbar>
      <ToolbarGroup className="mb-3">
        <SearchField
          value={fq}
          onChange={setFq}
          placeholder={
            tab === "payments" ? "Search guest, ref, reference" : tab === "expenses" ? "Search description, vendor" : "Search guest, ref, phone"
          }
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
        {tab !== "expenses" && (units?.length ?? 0) > 1 && <FilterSelect label="Room" value={room} onChange={setRoom} options={roomOptions} />}
        <ClearFilters active={filtering} onClear={clearFilters} />
      </ToolbarGroup>

      <Card className="overflow-hidden">
        <div>
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
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Method</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="w-24 px-4 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {pagedPayments.items.map((p) => (
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
                  <Button size="sm" onClick={() => setEditing("new")}>
                    <Plus className="size-4" /> Add expense
                  </Button>
                }
              >
                Record bills, salaries and supplies to see your real profit.
              </EmptyState>
            ) : (
              <>
              <table className="admin-table w-full text-sm">
                <thead className="text-left text-xs text-ink-muted">
                  <tr className="border-b border-sand-200">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Expense</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="w-24 px-4 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {pagedExpenses.items.map((e) => (
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
                    <th className="px-4 py-2.5 font-medium">Check-in</th>
                    <th className="px-4 py-2.5 font-medium">Guest</th>
                    <th className="px-4 py-2.5 font-medium hidden text-right sm:table-cell">Paid</th>
                    <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                    <th className="w-24 px-4 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {pagedUnpaid.items.map((b) => (
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
                      <td className="px-4 py-2.5 text-right font-medium text-terra-600 tabular-nums">{money(b.balance)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <ViewButton onClick={() => setOpenBooking(b.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination paged={pagedUnpaid} noun="booking" />
              </>
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
  return <StatTile label={label} value={value} sub={note} tone={tone === "bad" ? "warn" : "default"} />;
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
