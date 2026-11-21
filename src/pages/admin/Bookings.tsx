import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Download, Plus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { normalizeBooking } from "../../lib/queries";
import { downloadCsv, isoDate, money, plural, stayRange } from "../../lib/format";
import { SOURCE_LABEL, STATUS_LABEL, type BookingSummary } from "../../lib/types";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SearchField,
  Spinner,
  StatGrid,
  StatTile,
  StatusBadge,
  Tabs,
  Toolbar,
} from "../../components/ui";
import { BookingForm } from "../../components/admin/BookingForm";
import { stayInRange, useAdminRange } from "../../lib/admin-range";

type View = "action" | "upcoming" | "inhouse" | "past" | "cancelled" | "all";

export function useAllBookings() {
  return useQuery({
    queryKey: ["bookings", "all"],
    queryFn: async (): Promise<BookingSummary[]> => {
      const { data, error } = await supabase
        .from("booking_summary")
        .select("*")
        .order("check_in", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map(normalizeBooking);
    },
  });
}

export default function Bookings() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Old links (?id=) from booking emails open the booking's own page.
  const openId = params.get("id");
  const [view, setView] = useState<View>((params.get("view") as View) || "action");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const { data: all, isLoading } = useAllBookings();
  const today = isoDate(new Date());
  const range = useAdminRange();
  // What needs doing now ignores the dates; history follows the top bar's dates.
  const dated = view === "past" || view === "cancelled" || view === "all";

  const groups = useMemo(() => {
    const list = all ?? [];
    const inDates = (b: BookingSummary) => stayInRange(b.check_in, b.check_out, range.from, range.to);
    const byCheckIn = (a: BookingSummary, b: BookingSummary) => a.check_in.localeCompare(b.check_in);
    return {
      action: list.filter((b) => b.status === "pending").sort(byCheckIn),
      upcoming: list.filter((b) => b.status === "confirmed").sort(byCheckIn),
      inhouse: list.filter((b) => b.status === "checked_in").sort(byCheckIn),
      past: list.filter((b) => b.status === "checked_out" && inDates(b)),
      cancelled: list.filter((b) => (b.status === "cancelled" || b.status === "declined") && inDates(b)),
      all: list.filter(inDates),
    } satisfies Record<View, BookingSummary[]>;
  }, [all, range.from, range.to]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = groups[view];
    if (!term) return list;
    return list.filter((b) =>
      [b.ref, b.guest_name, b.guest_email, b.guest_phone, b.unit_name].some((v) => v?.toLowerCase().includes(term)),
    );
  }, [groups, view, q]);

  function open(id: string) {
    navigate(`/admin/bookings/${id}`);
  }

  const soon = isoDate(new Date(Date.now() + 7 * 86_400_000));
  const arriving = groups.upcoming.filter((b) => b.check_in >= today && b.check_in <= soon);
  const owed = (all ?? []).filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status) && b.balance > 0.009);
  const owedTotal = owed.reduce((s, b) => s + b.balance, 0);

  if (openId) return <Navigate to={`/admin/bookings/${openId}`} replace />;

  function exportCsv() {
    downloadCsv(`bookings-${today}.csv`, [
      ["Ref", "Guest", "Email", "Phone", "Room", "Check-in", "Check-out", "Nights", "Guests", "Status", "Source", "Total", "Paid", "Balance"],
      ...rows.map((b) => [
        b.ref,
        b.guest_name,
        b.guest_email,
        b.guest_phone,
        b.unit_name,
        b.check_in,
        b.check_out,
        b.nights,
        b.guests_count,
        STATUS_LABEL[b.status],
        SOURCE_LABEL[b.source],
        b.total,
        b.paid,
        b.balance,
      ]),
    ]);
  }

  return (
    <>
      <PageHeader
        title="Bookings"
        description={
          dated
            ? `Stays with a night in ${range.label}. Change the dates in the top bar.`
            : "Needs action, upcoming and in house always show everything open."
        }
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add booking
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Needs action"
          value={String(groups.action.length)}
          tone={groups.action.length ? "warn" : "default"}
          sub={groups.action.length ? "Requests to confirm" : "Nothing waiting"}
        />
        <StatTile
          label="Arriving · 7 days"
          value={String(arriving.length)}
          sub={plural(arriving.reduce((s, b) => s + b.guests_count, 0), "guest")}
        />
        <StatTile
          label="In house"
          value={String(groups.inhouse.length)}
          sub={plural(groups.inhouse.reduce((s, b) => s + b.guests_count, 0), "guest")}
        />
        <StatTile
          label="Unpaid balances"
          value={money(owedTotal, true)}
          tone={owedTotal > 0 ? "warn" : "default"}
          sub={plural(owed.length, "booking")}
        />
      </StatGrid>

      <Toolbar>
          <Tabs
            value={view}
            onChange={setView}
            items={[
              { value: "action", label: "Needs action", count: groups.action.length, waiting: true },
              { value: "upcoming", label: "Upcoming", count: groups.upcoming.length },
              { value: "inhouse", label: "In house", count: groups.inhouse.length },
              { value: "past", label: "Past", count: groups.past.length },
              { value: "cancelled", label: "Cancelled", count: groups.cancelled.length },
              { value: "all", label: "All", count: groups.all.length },
            ]}
          />
          <SearchField value={q} onChange={setQ} placeholder="Search guest, ref, phone" />
      </Toolbar>

      <Card className="overflow-hidden">
        <div>
          {isLoading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-8" />} title={q ? "No matches" : "Nothing here"}>
              {view === "action" && !q ? "New website requests show up here for you to confirm." : undefined}
            </EmptyState>
          ) : (
            <>
              <table className="admin-table hidden w-full text-sm md:table">
                <thead className="text-left text-xs text-ink-muted">
                  <tr className="border-b border-sand-200">
                    <th className="px-4 py-2.5 font-medium">Guest</th>
                    <th className="px-4 py-2.5 font-medium">Stay</th>
                    <th className="px-4 py-2.5 font-medium">Room</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {rows.map((b) => (
                    <tr key={b.id} onClick={() => open(b.id)} className="cursor-pointer hover:bg-sand-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{b.guest_name}</p>
                        <p className="font-mono text-xs text-ink-muted">
                          {b.ref} · {SOURCE_LABEL[b.source]}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{stayRange(b.check_in, b.check_out)}</p>
                        <p className="text-xs text-ink-muted">
                          {plural(b.nights, "night")} · {plural(b.guests_count, "guest")}
                        </p>
                      </td>
                      <td className="px-4 py-3">{b.unit_name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(b.total)}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${b.balance > 0 && b.status !== "cancelled" && b.status !== "declined" ? "font-medium text-terra-600" : "text-ink-muted"}`}
                      >
                        {money(b.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-sand-200 md:hidden">
                {rows.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => open(b.id)} className="w-full px-4 py-3 text-left hover:bg-sand-50">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{b.guest_name}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {stayRange(b.check_in, b.check_out)} · {b.unit_name}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {b.ref} · {money(b.total)}
                        {b.balance > 0 && ` · ${money(b.balance)} due`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>

      <BookingForm open={adding} onClose={() => setAdding(false)} onSaved={(id) => open(id)} />
    </>
  );
}
