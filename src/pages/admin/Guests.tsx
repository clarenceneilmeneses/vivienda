import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Users } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { downloadCsv, isoDate, money, plural, prettyDate, stayRange } from "../../lib/format";
import { STAY_STATUSES, type BookingSummary, type Guest } from "../../lib/types";
import {
  Button,
  Card,
  ClearFilters,
  EmptyState,
  Field,
  FilterSelect,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchField,
  Spinner,
  StatGrid,
  StatTile,
  StatusBadge,
  Textarea,
  Toolbar,
  ToolbarGroup,
  usePaged,
  ViewButton,
} from "../../components/ui";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { useAllBookings } from "./Bookings";

type Kind = "all" | "stayed" | "repeat" | "never" | "account" | "owing";

interface GuestRow extends Guest {
  stays: number;
  spent: number;
  lastStay: string | null;
  bookings: BookingSummary[];
}

export default function Guests() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
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
    const ofKind = (g: GuestRow) => {
      switch (kind) {
        case "stayed":
          return g.stays > 0;
        case "repeat":
          return g.stays >= 2;
        case "never":
          return g.stays === 0;
        case "account":
          return !!(g as unknown as { user_id?: string | null }).user_id;
        case "owing":
          return g.bookings.some((b) => STAY_STATUSES.includes(b.status) && b.balance > 0.009);
        default:
          return true;
      }
    };
    return rows.filter(
      (g) => ofKind(g) && (!term || [g.full_name, g.email, g.phone].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [rows, q, kind]);
  const paged = usePaged(filtered, [q, kind]);

  const current = rows.find((g) => g.id === selected) ?? null;
  const repeat = rows.filter((g) => g.stays >= 2).length;
  const withAccount = rows.filter((g) => (g as unknown as { user_id?: string | null }).user_id).length;
  const lifetime = rows.reduce((s, g) => s + g.spent, 0);
  const stayed = rows.filter((g) => g.stays > 0).length;

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
      <StatGrid>
        <StatTile label="Guests on file" value={String(rows.length)} sub={`${stayed} have stayed`} />
        <StatTile
          label="Repeat guests"
          value={String(repeat)}
          sub={stayed ? `${Math.round((repeat / stayed) * 100)}% came back` : "No stays yet"}
        />
        <StatTile label="With an account" value={String(withAccount)} sub="Can message you from the site" />
        <StatTile label="Paid, all time" value={money(lifetime, true)} sub={stayed ? `${money(lifetime / stayed, true)} per guest` : undefined} />
      </StatGrid>

      <Toolbar>
        <span className="text-sm text-ink-muted">{plural(filtered.length, "guest")}</span>
        <ToolbarGroup>
          <FilterSelect
            label="Show"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All guests" },
              { value: "stayed", label: "Have stayed" },
              { value: "repeat", label: "Repeat guests" },
              { value: "never", label: "Never stayed" },
              { value: "account", label: "With an account" },
              { value: "owing", label: "Balance due" },
            ]}
          />
          <SearchField value={q} onChange={setQ} placeholder="Search name, email, phone" />
          <ClearFilters
            active={kind !== "all" || q !== ""}
            onClear={() => {
              setQ("");
              setKind("all");
            }}
          />
        </ToolbarGroup>
      </Toolbar>

      <Card className="overflow-hidden">
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="size-8" />} title={q || kind !== "all" ? "No matches" : "No guests yet"}>
            {!q && kind === "all" && "Guests are added automatically when they book."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto lg:overflow-visible">
            <table className="admin-table w-full text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr className="border-b border-sand-200">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Contact</th>
                  <th className="px-4 py-2.5 text-right font-medium">Stays</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Paid</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last stay</th>
                  <th className="w-24 px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {paged.items.map((g) => (
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
                    <td className="px-4 py-3 text-right">
                      <ViewButton onClick={() => setSelected(g.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination paged={paged} noun="guest" />
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
