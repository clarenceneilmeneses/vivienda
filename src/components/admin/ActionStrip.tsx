import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, ClipboardCheck, LogIn, LogOut, MessageSquare } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { sendBookingEmail } from "../../lib/email";
import { money, plural, stayRange } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { BookingStatus, BookingSummary } from "../../lib/types";
import { ask, Button, EmptyState, Modal, StatusBadge } from "../ui";

/**
 * What waits on the owner today, as one slim strip (Malaya's action strip):
 * a chip per kind of thing, each opening a pop-up where it can be done in
 * place — confirm a request, check guests in or out — without leaving the
 * Dashboard.
 */

type Kind = "messages" | "requests" | "arrivals" | "departures";

interface Step {
  to: BookingStatus;
  label: string;
  question: (b: BookingSummary) => string;
  done: string;
  email?: "booking_confirmed";
}

const STEP: Partial<Record<Kind, Step>> = {
  requests: {
    to: "confirmed",
    label: "Confirm",
    question: (b) => `Confirm ${b.guest_name.split(" ")[0]}'s stay, ${stayRange(b.check_in, b.check_out)}?`,
    done: "Confirmed",
    email: "booking_confirmed",
  },
  arrivals: {
    to: "checked_in",
    label: "Check in",
    question: (b) => `Check ${b.guest_name.split(" ")[0]} in?`,
    done: "Checked in",
  },
  departures: {
    to: "checked_out",
    label: "Check out",
    question: (b) => `Check ${b.guest_name.split(" ")[0]} out?`,
    done: "Checked out",
  },
};

export function ActionStrip({
  unread,
  requests,
  arrivals,
  departures,
}: {
  unread: number;
  requests: BookingSummary[];
  arrivals: BookingSummary[];
  departures: BookingSummary[];
}) {
  const [open, setOpen] = useState<Kind | null>(null);
  const chips: { kind: Kind; n: number; icon: ReactNode; label: string }[] = [
    { kind: "messages" as const, n: unread, icon: <MessageSquare />, label: unread === 1 ? "unread message" : "unread messages" },
    { kind: "requests" as const, n: requests.length, icon: <ClipboardCheck />, label: requests.length === 1 ? "request to confirm" : "requests to confirm" },
    { kind: "arrivals" as const, n: arrivals.length, icon: <LogIn />, label: arrivals.length === 1 ? "arrival today" : "arrivals today" },
    { kind: "departures" as const, n: departures.length, icon: <LogOut />, label: departures.length === 1 ? "check-out due" : "check-outs due" },
  ].filter((c) => c.n > 0);

  if (!chips.length) return null;

  const lists: Record<Exclude<Kind, "messages">, BookingSummary[]> = { requests, arrivals, departures };
  const titles: Record<Kind, string> = {
    messages: "Waiting for a reply",
    requests: "Booking requests",
    arrivals: "Arriving today",
    departures: "Due to check out",
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-full border border-amber-200 bg-amber-50/70 p-1 pl-4 shadow-level-1 sm:flex-nowrap">
        <span className="hidden shrink-0 text-xs font-semibold tracking-wide text-amber-900 uppercase sm:inline">Needs you</span>
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {chips.map((c) => (
            <button
              key={c.kind}
              type="button"
              onClick={() => setOpen(c.kind)}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 text-sm text-amber-950 shadow-level-1 transition-colors hover:bg-amber-100 [&_svg]:size-3.5"
            >
              {c.icon}
              <span className="font-semibold tabular-nums">{c.n}</span> {c.label}
              <ChevronRight className="opacity-50" />
            </button>
          ))}
        </div>
      </div>

      {open === "messages" && <MessagesModal onClose={() => setOpen(null)} />}
      {open && open !== "messages" && (
        <BookingsModal title={titles[open]} rows={lists[open]} step={STEP[open]!} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function BookingsModal({
  title,
  rows,
  step,
  onClose,
}: {
  title: string;
  rows: BookingSummary[];
  step: Step;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(b: BookingSummary) {
    const sure = await ask({
      title: step.question(b),
      description: (
        <>
          {b.ref} · {plural(b.guests_count, "guest")}
          {b.balance > 0.009 && <span className="mt-1 block text-terra-600">{money(b.balance, true)} still to collect.</span>}
          {step.email && b.guest_email && <span className="mt-1 block">We'll email {b.guest_email}.</span>}
        </>
      ),
      confirmLabel: step.label,
      tone: "success",
    });
    if (!sure) return;
    setBusy(b.id);
    const { error } = await supabase.from("bookings").update({ status: step.to }).eq("id", b.id);
    setBusy(null);
    if (error) return void toast.error(errorMessage(error));
    toast.success(`${step.done}: ${b.guest_name}`);
    if (step.email && b.guest_email) void sendBookingEmail(step.email, b.id);
    await qc.invalidateQueries();
  }

  return (
    <Modal open onClose={onClose} title={title} description={plural(rows.length, "booking")} size="lg">
      {rows.length === 0 ? (
        <EmptyState icon={<CheckCircle2 />} title="All done" />
      ) : (
        <ul className="-mx-2 divide-y divide-sand-200">
          {rows.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium text-ink">
                  <span className="truncate">{b.guest_name}</span>
                  <StatusBadge status={b.status} />
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {stayRange(b.check_in, b.check_out)} · {plural(b.guests_count, "guest")} · {b.ref}
                  {b.balance > 0.009 && <span className="text-terra-600"> · {money(b.balance, true)} due</span>}
                </p>
              </div>
              <Link to={`/admin/bookings/${b.id}`} onClick={onClose} className="link-action text-sm">
                Open
              </Link>
              <Button size="sm" variant="success" loading={busy === b.id} onClick={() => act(b)}>
                {step.label}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

interface Unread {
  id: string;
  guest_id: string;
  last_message_preview: string;
  last_message_at: string;
  guest: { full_name: string } | null;
}

function MessagesModal({ onClose }: { onClose: () => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["inbox", "unread-list"],
    queryFn: async (): Promise<Unread[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, guest_id, last_message_preview, last_message_at, guest:guests(full_name)")
        .eq("admin_unread", true)
        .is("archived_at", null)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Unread[];
    },
  });
  return (
    <Modal open onClose={onClose} title="Waiting for a reply" description={isLoading ? undefined : plural(data.length, "conversation")} size="lg">
      {data.length === 0 && !isLoading ? (
        <EmptyState icon={<CheckCircle2 />} title="All replied to" />
      ) : (
        <ul className="-mx-2 divide-y divide-sand-200">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                to={`/admin/inbox?guest=${c.guest_id}`}
                onClick={onClose}
                className={cn("flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-sand-50")}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700/10 text-sm font-semibold text-brand-700">
                  {(c.guest?.full_name ?? "?").charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{c.guest?.full_name ?? "Guest"}</span>
                  <span className="block truncate text-sm text-ink-muted">{c.last_message_preview}</span>
                </span>
                <span className="link-action shrink-0 text-sm">Reply</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
