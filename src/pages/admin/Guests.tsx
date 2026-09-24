import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Search, Users } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { downloadCsv, isoDate, money, prettyDate, stayRange } from "../../lib/format";
import { STAY_STATUSES, type BookingSummary, type Guest } from "../../lib/types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  Textarea,
} from "../../components/ui";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { useAllBookings } from "./Bookings";

interface GuestRow extends Guest {
  stays: number;
  spent: number;
  lastStay: string | null;
  bookings: BookingSummary[];
}

export default function Guests() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);

  const { data: guests, isLoading } = useQuery({
    queryKey: ["guests", "all"],
    queryFn: async (): Promise<Guest[]> => {
      const { data, error } = await supabase.from("guests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Guest[];
    },
  });
  const { data: bookings } = useAllBookings();

  const rows = useMemo<GuestRow[]>(() => {
    const byGuest = new Map<string, BookingSummary[]>();
    (bookings ?? []).forEach((b) => {
      if (!byGuest.has(b.guest_id)) byGuest.set(b.guest_id, []);
      byGuest.get(b.guest_id)!.push(b);
    });
    return (guests ?? []).map((g) => {
      const list = byGuest.get(g.id) ?? [];
      const real = list.filter((b) => STAY_STATUSES.includes(b.status));
      return {
        ...g,
        bookings: list,
        stays: real.length,
        spent: list.reduce((s, b) => s + b.paid, 0),
        lastStay: real.map((b) => b.check_in).sort().pop() ?? null,
      };
    });
  }, [guests, bookings]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((g) => [g.full_name, g.email, g.phone].some((v) => v?.toLowerCase().includes(term)));
  }, [rows, q]);

  const current = rows.find((g) => g.id === selected) ?? null;

  return (
    <>
      <PageHeader
        title="Guests"
        description={guests ? `${guests.length} guests on file` : undefined}
        actions={
          <Button
            variant="secondary"
            disabled={!filtered.length}
            onClick={() =>
              downloadCsv(`guests-${isoDate(new Date())}.csv`, [
                ["Name", "Email", "Phone", "Stays", "Total paid", "Last stay", "Notes"],
                ...filtered.map((g) => [g.full_name, g.email, g.phone, g.stays, g.spent, g.lastStay, g.notes]),
              ])
            }
          >
            <Download className="size-4" /> Export
          </Button>
        }
      />
      <Card>
        <div className="border-b border-sand-200 p-3">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <Input placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 pl-9" />
          </div>
        </div>
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="size-8" />} title={q ? "No matches" : "No guests yet"}>
            {!q && "Guests are added automatically when they book."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr className="border-b border-sand-200">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Contact</th>
                  <th className="px-4 py-2.5 text-right font-medium">Stays</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Paid</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last stay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {filtered.map((g) => (
                  <tr key={g.id} onClick={() => setSelected(g.id)} className="cursor-pointer hover:bg-sand-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{g.full_name}</p>
                      <p className="text-xs text-ink-muted sm:hidden">{g.email || g.phone}</p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <p>{g.email || "—"}</p>
                      <p className="text-xs text-ink-muted">{g.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {g.stays}
                      {g.stays > 1 && (
                        <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 text-xs text-brand-700">Repeat</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{money(g.spent, true)}</td>
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{prettyDate(g.lastStay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {current && (
        <GuestModal
          guest={current}
          onClose={() => setSelected(null)}
          onOpenBooking={(id) => {
            setSelected(null);
            setOpenBooking(id);
          }}
        />
      )}
      <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />
    </>
  );
}

function GuestModal({
  guest,
  onClose,
  onOpenBooking,
}: {
  guest: GuestRow;
  onClose: () => void;
  onOpenBooking: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(guest.full_name);
  const [email, setEmail] = useState(guest.email ?? "");
  const [phone, setPhone] = useState(guest.phone ?? "");
  const [notes, setNotes] = useState(guest.notes ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(guest.full_name);
    setEmail(guest.email ?? "");
    setPhone(guest.phone ?? "");
    setNotes(guest.notes ?? "");
  }, [guest.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!name.trim()) return toast.error("Name can't be empty.");
    setSaving(true);
    const { error } = await supabase
      .from("guests")
      .update({
        full_name: name.trim(),
        email: email.trim().toLowerCase() || null,
        phone: phone.trim() || null,
        notes: notes.trim(),
      })
      .eq("id", guest.id);
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "Another guest already uses that email." : errorMessage(error));
      return;
    }
    toast.success("Guest saved");
    await qc.invalidateQueries();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={guest.full_name}
      description={`Guest since ${prettyDate(guest.created_at.slice(0, 10))} · ${money(guest.spent)} paid`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Email">
            {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Mobile">
            {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <Field label="Notes" optional className="sm:col-span-2" hint="Preferences, allergies, anything to remember.">
            {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Bookings</p>
          {guest.bookings.length === 0 ? (
            <p className="text-sm text-ink-muted">None yet.</p>
          ) : (
            <ul className="divide-y divide-sand-200 rounded-lg border border-sand-200">
              {guest.bookings.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => onOpenBooking(b.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sand-50"
                  >
                    <span>
                      {stayRange(b.check_in, b.check_out)}
                      <span className="block text-xs text-ink-muted">
                        {b.unit_name} · {b.ref}
                      </span>
                    </span>
                    <StatusBadge status={b.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
