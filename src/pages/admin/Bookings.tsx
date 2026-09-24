import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Download, Plus, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { normalizeBooking } from "../../lib/queries";
import { downloadCsv, isoDate, money, plural, stayRange } from "../../lib/format";
import { SOURCE_LABEL, STATUS_LABEL, type BookingSummary } from "../../lib/types";
import { Button, Card, EmptyState, Input, PageHeader, Spinner, StatusBadge, Tabs } from "../../components/ui";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { BookingForm } from "../../components/admin/BookingForm";

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
  const [params, setParams] = useSearchParams();
  const openId = params.get("id");
  const [view, setView] = useState<View>((params.get("view") as View) || "action");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const { data: all, isLoading } = useAllBookings();
  const today = isoDate(new Date());

  const groups = useMemo(() => {
    const list = all ?? [];
    const byCheckIn = (a: BookingSummary, b: BookingSummary) => a.check_in.localeCompare(b.check_in);
    return {
      action: list.filter((b) => b.status === "pending").sort(byCheckIn),
      upcoming: list.filter((b) => b.status === "confirmed").sort(byCheckIn),
      inhouse: list.filter((b) => b.status === "checked_in").sort(byCheckIn),
      past: list.filter((b) => b.status === "checked_out"),
      cancelled: list.filter((b) => b.status === "cancelled" || b.status === "declined"),
      all: list,
    } satisfies Record<View, BookingSummary[]>;
  }, [all]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = groups[view];
    if (!term) return list;
    return list.filter((b) =>
      [b.ref, b.guest_name, b.guest_email, b.guest_phone, b.unit_name].some((v) => v?.toLowerCase().includes(term)),
    );
  }, [groups, view, q]);

  function open(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("id", id);
    else next.delete("id");
    setParams(next, { replace: true });
  }

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

      <Card>
        <div className="flex flex-col gap-3 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <Tabs
            value={view}
            onChange={setView}
            items={[
              { value: "action", label: "Needs action", count: groups.action.length },
              { value: "upcoming", label: "Upcoming", count: groups.upcoming.length },
              { value: "inhouse", label: "In house", count: groups.inhouse.length },
              { value: "past", label: "Past" },
              { value: "cancelled", label: "Cancelled" },
              { value: "all", label: "All" },
            ]}
            className="border-b-0"
          />
          <div className="relative mb-2 sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <Input
              placeholder="Search guest, ref, phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
        </div>
        <div className="border-t border-sand-200">
          {isLoading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-8" />} title={q ? "No matches" : "Nothing here"}>
              {view === "action" && !q ? "New website requests show up here for you to confirm." : undefined}
            </EmptyState>
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
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
                        className={`px-4 py-3 text-right tabular-nums ${b.balance > 0 && b.status !== "cancelled" && b.status !== "declined" ? "font-medium text-clay-600" : "text-ink-muted"}`}
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

      <BookingDrawer bookingId={openId} onClose={() => open(null)} />
      <BookingForm open={adding} onClose={() => setAdding(false)} onSaved={(id) => open(id)} />
    </>
  );
}
