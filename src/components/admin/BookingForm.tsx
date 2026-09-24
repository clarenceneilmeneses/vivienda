import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addYears, eachDayOfInterval, parseISO, subDays } from "date-fns";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { useUnavailableNights, useUnits } from "../../lib/queries";
import { isoDate, money, plural, stayRange } from "../../lib/format";
import { sendBookingEmail } from "../../lib/email";
import { cn } from "../../lib/utils";
import {
  SOURCE_LABEL,
  type BookingSource,
  type BookingStatus,
  type BookingSummary,
  type Guest,
  type Quote,
} from "../../lib/types";
import { RangeCalendar, type DateRange } from "../RangeCalendar";
import { Button, ErrorBox, Field, Input, Modal, Select, Textarea } from "../ui";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit this booking; omit to create one. */
  booking?: BookingSummary | null;
  /** Prefill for a new booking (e.g. clicked on the calendar). */
  preset?: { unitId?: string; checkIn?: string };
  onSaved?: (id: string) => void;
}

export function BookingForm({ open, onClose, booking, preset, onSaved }: Props) {
  if (!open) return null;
  return <BookingFormInner onClose={onClose} booking={booking ?? null} preset={preset} onSaved={onSaved} />;
}

function BookingFormInner({
  onClose,
  booking,
  preset,
  onSaved,
}: {
  onClose: () => void;
  booking: BookingSummary | null;
  preset?: { unitId?: string; checkIn?: string };
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: units } = useUnits();
  const editing = Boolean(booking);

  const [unitId, setUnitId] = useState(booking?.unit_id ?? preset?.unitId ?? "");
  const [range, setRange] = useState<DateRange>({
    checkIn: booking?.check_in ?? preset?.checkIn ?? null,
    checkOut: booking?.check_out ?? null,
  });
  const [guestsCount, setGuestsCount] = useState(booking?.guests_count ?? 2);
  const [source, setSource] = useState<BookingSource>(booking?.source ?? "facebook");
  const [status, setStatus] = useState<BookingStatus>(booking?.status ?? "confirmed");
  const [guestMode, setGuestMode] = useState<"existing" | "new">(booking ? "existing" : "new");
  const [guestId, setGuestId] = useState<string | null>(booking?.guest_id ?? null);
  const [guestSearch, setGuestSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [discount, setDiscount] = useState(String(booking?.discount ?? 0));
  const [totalOverride, setTotalOverride] = useState<string>(booking ? String(booking.total) : "");
  const [requests, setRequests] = useState(booking?.special_requests ?? "");
  const [notes, setNotes] = useState(booking?.admin_notes ?? "");
  const [emailGuest, setEmailGuest] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId && units?.length) setUnitId(units[0].id);
  }, [units, unitId]);

  const unit = units?.find((u) => u.id === unitId);
  const minDate = isoDate(addYears(new Date(), -1));
  const { data: taken } = useUnavailableNights(unitId, minDate, isoDate(addYears(new Date(), 2)));

  // When editing, this booking's own nights shouldn't block itself.
  const unavailable = useMemo(() => {
    const s = new Set(taken ?? []);
    if (booking && booking.unit_id === unitId) {
      eachDayOfInterval({ start: parseISO(booking.check_in), end: subDays(parseISO(booking.check_out), 1) }).forEach(
        (d) => s.delete(isoDate(d)),
      );
    }
    return s;
  }, [taken, booking, unitId]);

  const { data: guests } = useQuery({
    queryKey: ["guests", "picker"],
    queryFn: async (): Promise<Guest[]> => {
      const { data, error } = await supabase.from("guests").select("*").order("full_name");
      if (error) throw error;
      return (data ?? []) as Guest[];
    },
  });
  const matches = useMemo(() => {
    const q = guestSearch.trim().toLowerCase();
    const list = guests ?? [];
    if (!q) return list.slice(0, 6);
    return list
      .filter((g) => [g.full_name, g.email, g.phone].some((v) => v?.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [guests, guestSearch]);
  const selectedGuest = guests?.find((g) => g.id === guestId);

  const { data: quote } = useQuery({
    queryKey: ["quote", unitId, range.checkIn, range.checkOut, guestsCount],
    enabled: Boolean(unitId && range.checkIn && range.checkOut),
    queryFn: async (): Promise<Quote> => {
      const { data, error } = await supabase.rpc("quote_stay", {
        p_unit: unitId,
        p_check_in: range.checkIn,
        p_check_out: range.checkOut,
        p_guests: guestsCount,
      });
      if (error) throw error;
      const r = (data as Quote[])[0];
      return { nights: r.nights, room_total: Number(r.room_total), extra_guest_total: Number(r.extra_guest_total), total: Number(r.total) };
    },
  });

  const discountNum = Math.max(0, Number(discount) || 0);
  const computedTotal = quote ? Math.max(0, quote.total - discountNum) : null;
  const total = totalOverride !== "" ? Math.max(0, Number(totalOverride) || 0) : computedTotal;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!unitId) return setError("Pick a room.");
    if (!range.checkIn || !range.checkOut) return setError("Pick check-in and check-out dates.");
    if (guestMode === "existing" && !guestId) return setError("Pick a guest, or add a new one.");
    if (guestMode === "new" && !newName.trim()) return setError("Enter the guest's name.");
    if (total == null) return setError("Waiting for the price…");

    setSaving(true);
    try {
      let gid = guestId;
      if (guestMode === "new") {
        const email = newEmail.trim().toLowerCase() || null;
        const existing = email ? guests?.find((g) => g.email?.toLowerCase() === email) : undefined;
        if (existing) {
          gid = existing.id;
        } else {
          const { data, error } = await supabase
            .from("guests")
            .insert({ full_name: newName.trim(), email, phone: newPhone.trim() || null })
            .select("id")
            .single();
          if (error) throw error;
          gid = data.id as string;
        }
      }

      const row = {
        unit_id: unitId,
        guest_id: gid,
        check_in: range.checkIn,
        check_out: range.checkOut,
        guests_count: guestsCount,
        source,
        subtotal: quote?.total ?? total,
        discount: discountNum,
        total,
        special_requests: requests.trim(),
        admin_notes: notes.trim(),
      };

      let id: string;
      if (booking) {
        const { error } = await supabase.from("bookings").update(row).eq("id", booking.id);
        if (error) throw error;
        id = booking.id;
      } else {
        const { data, error } = await supabase.from("bookings").insert({ ...row, status }).select("id").single();
        if (error) throw error;
        id = data.id as string;
      }

      await qc.invalidateQueries();
      toast.success(editing ? "Booking updated" : "Booking added");

      const guestEmail = guestMode === "new" ? newEmail.trim() : selectedGuest?.email;
      if (!editing && emailGuest && guestEmail) {
        const type = status === "pending" ? "booking_received" : "booking_confirmed";
        sendBookingEmail(type, id).then((r) =>
          r.ok && r.status === "sent" ? toast.success("Email sent to guest") : r.ok ? undefined : toast.error(r.message),
        );
      }
      onSaved?.(id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${booking!.ref}` : "Add booking"}
      description={editing ? undefined : "For bookings from Facebook, walk-ins or calls."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="booking-form" loading={saving}>
            {editing ? "Save changes" : "Add booking"}
          </Button>
        </>
      }
    >
      <form id="booking-form" onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Room" className="sm:col-span-2">
            {(id) => (
              <Select
                id={id}
                value={unitId}
                onChange={(e) => {
                  setUnitId(e.target.value);
                  if (!editing) setRange({ checkIn: range.checkIn, checkOut: null });
                }}
              >
                {(units ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {!u.is_active ? " (hidden)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Guests" hint={unit ? `Fits ${unit.max_guests}` : undefined}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                value={guestsCount}
                onChange={(e) => setGuestsCount(Math.max(1, Number(e.target.value) || 1))}
              />
            )}
          </Field>
        </div>

        <div className="rounded-xl border border-sand-200 p-3">
          <RangeCalendar
            value={range}
            onChange={setRange}
            unavailable={unavailable}
            minDate={minDate}
            months={1}
          />
          <p className="mt-2 text-center text-sm text-ink-soft">
            {range.checkIn && range.checkOut
              ? `${stayRange(range.checkIn, range.checkOut)} · ${plural(quote?.nights ?? 0, "night")}`
              : range.checkIn
                ? "Now pick the check-out date"
                : "Pick the check-in date"}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Guest</span>
            <div className="flex rounded-lg bg-sand-100 p-0.5 text-xs">
              {(["existing", "new"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setGuestMode(m)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1",
                    guestMode === m ? "bg-white font-medium shadow-sm" : "text-ink-muted",
                  )}
                >
                  {m === "existing" ? <Users className="size-3.5" /> : <UserPlus className="size-3.5" />}
                  {m === "existing" ? "Returning" : "New guest"}
                </button>
              ))}
            </div>
          </div>
          {guestMode === "existing" ? (
            <div className="space-y-2">
              <Input
                placeholder="Search name, email or phone"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
              />
              <ul className="divide-y divide-sand-200 rounded-lg border border-sand-200">
                {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink-muted">No guests found.</li>}
                {matches.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setGuestId(g.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                        guestId === g.id ? "bg-forest-50" : "hover:bg-sand-50",
                      )}
                    >
                      <span className="font-medium">{g.full_name}</span>
                      <span className="truncate text-xs text-ink-muted">{g.email || g.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {selectedGuest && !matches.some((m) => m.id === selectedGuest.id) && (
                <p className="text-xs text-ink-muted">Selected: {selectedGuest.full_name}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input
                placeholder="Email (for confirmations)"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Input placeholder="Mobile" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Booked via">
            {(id) => (
              <Select id={id} value={source} onChange={(e) => setSource(e.target.value as BookingSource)}>
                {Object.entries(SOURCE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {!editing && (
            <Field label="Status">
              {(id) => (
                <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending (waiting for payment)</option>
                  <option value="checked_in">Already checked in</option>
                </Select>
              )}
            </Field>
          )}
        </div>

        <div className="rounded-xl bg-sand-50 p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-sm">
              <p className="text-ink-muted">Rate for these dates</p>
              <p className="mt-1 text-lg font-semibold">{quote ? money(quote.total) : "—"}</p>
            </div>
            <Field label="Discount (₱)">
              {(id) => (
                <Input id={id} type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
              )}
            </Field>
            <Field
              label="Total charged (₱)"
              hint={totalOverride === "" ? "Rate minus discount" : "Custom amount"}
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  placeholder={computedTotal != null ? String(computedTotal) : ""}
                  value={totalOverride}
                  onChange={(e) => setTotalOverride(e.target.value)}
                />
              )}
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Guest requests" optional>
            {(id) => <Textarea id={id} value={requests} onChange={(e) => setRequests(e.target.value)} rows={2} />}
          </Field>
          <Field label="Private notes" optional hint="Only you see these.">
            {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
          </Field>
        </div>

        {!editing && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={emailGuest}
              onChange={(e) => setEmailGuest(e.target.checked)}
              className="size-4 accent-forest-700"
            />
            Email the guest a {status === "pending" ? "booking summary" : "confirmation"} (if they have an email)
          </label>
        )}

        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}

