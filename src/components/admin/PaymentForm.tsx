import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage, supabase } from "../../lib/supabase";
import { isoDate, money } from "../../lib/format";
import { sendBookingEmail } from "../../lib/email";
import { METHOD_LABEL, type BookingSummary, type PaymentMethod } from "../../lib/types";
import { Button, ErrorBox, Field, Input, Modal, Select } from "../ui";

export function PaymentForm({
  booking,
  open,
  onClose,
}: {
  booking: BookingSummary;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return <Inner booking={booking} onClose={onClose} />;
}

function Inner({ booking, onClose }: { booking: BookingSummary; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"payment" | "refund">("payment");
  const [amount, setAmount] = useState(booking.balance > 0 ? String(booking.balance) : "");
  const [method, setMethod] = useState<PaymentMethod>(booking.payment_method ?? "gcash");
  const [paidOn, setPaidOn] = useState(isoDate(new Date()));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [emailReceipt, setEmailReceipt] = useState(Boolean(booking.guest_email));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!(amt > 0)) return setError("Enter an amount above zero.");
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("payments").insert({
      booking_id: booking.id,
      kind,
      amount: amt,
      method,
      paid_on: paidOn,
      reference: reference.trim(),
      notes: notes.trim(),
    });
    setSaving(false);
    if (error) return setError(errorMessage(error));
    await qc.invalidateQueries();
    toast.success(kind === "refund" ? "Refund recorded" : `${money(amt)} recorded`);
    if (kind === "payment" && emailReceipt) {
      sendBookingEmail("payment_received", booking.id).then((r) =>
        r.ok ? r.status === "sent" && toast.success("Receipt emailed") : toast.error(r.message),
      );
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Record ${kind} · ${booking.ref}`}
      description={`Balance: ${money(booking.balance)} of ${money(booking.total)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={save} className="space-y-4">
        <div className="flex rounded-lg bg-sand-100 p-0.5 text-sm">
          {(["payment", "refund"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 rounded-md py-1.5 capitalize ${kind === k ? "bg-white font-medium shadow-sm" : "text-ink-muted"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₱)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Field label="Date">
            {(id) => <Input id={id} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
          </Field>
        </div>
        <Field label="Method">
          {(id) => (
            <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(METHOD_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reference no." optional hint="GCash or bank reference, if any.">
          {(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} />}
        </Field>
        <Field label="Note" optional>
          {(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        {kind === "payment" && booking.guest_email && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={emailReceipt}
              onChange={(e) => setEmailReceipt(e.target.checked)}
              className="size-4 accent-brand-700"
            />
            Email a receipt to {booking.guest_email}
          </label>
        )}
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}
