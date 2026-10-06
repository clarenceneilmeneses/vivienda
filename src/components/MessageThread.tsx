import { useState, type ReactNode } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Ban, CalendarCheck, MoreHorizontal, Pencil, Siren, Undo2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { Message } from "../lib/types";
import { Button, Textarea } from "./ui";

export interface MessageActions {
  onEdit: (m: Message, body: string) => Promise<void>;
  onUnsend: (m: Message) => Promise<void>;
}

function dayLabel(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d, yyyy");
}

/**
 * A conversation drawn the way messaging apps draw one: your messages on the
 * right in brand brown, theirs on the left, a day line when the date changes,
 * consecutive messages grouped, and "Seen" under the last thing you sent once
 * the other side has opened it. Booking events sit in the middle as notes.
 */
export function MessageThread({
  messages,
  viewer,
  otherSeenAt,
  hostName,
  guestName,
  actions,
  empty,
  bookingLink,
}: {
  messages: Message[];
  viewer: "guest" | "host";
  /** When the other side last opened the thread. */
  otherSeenAt?: string | null;
  hostName: string;
  guestName?: string;
  actions?: MessageActions;
  empty?: ReactNode;
  bookingLink?: (bookingId: string) => ReactNode;
}) {
  if (messages.length === 0) {
    return <div className="px-6 py-10 text-center text-sm text-ink-muted">{empty ?? "No messages yet."}</div>;
  }

  const lastMine = [...messages].reverse().find((m) => m.author === viewer && m.kind !== "booking");
  const seen = Boolean(lastMine && otherSeenAt && otherSeenAt >= lastMine.sent_at);

  return (
    <ol className="flex flex-col gap-1 px-1">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay = !prev || prev.sent_at.slice(0, 10) !== m.sent_at.slice(0, 10);
        const mine = m.author === viewer;
        const grouped =
          prev && !newDay && prev.author === m.author && prev.kind !== "booking" &&
          parseISO(m.sent_at).getTime() - parseISO(prev.sent_at).getTime() < 5 * 60_000;
        const lastOfGroup =
          !next || next.author !== m.author || next.kind === "booking" ||
          next.sent_at.slice(0, 10) !== m.sent_at.slice(0, 10) ||
          parseISO(next.sent_at).getTime() - parseISO(m.sent_at).getTime() >= 5 * 60_000;

        return (
          <li key={m.id} className="contents">
            {newDay && (
              <div className="my-3 flex items-center gap-3 text-[11px] font-medium text-ink-muted" role="separator">
                <span className="h-px flex-1 bg-sand-200" />
                {dayLabel(m.sent_at)}
                <span className="h-px flex-1 bg-sand-200" />
              </div>
            )}
            {m.kind === "booking" ? (
              <div className="my-2 flex justify-center">
                <div className="flex max-w-[90%] items-start gap-2 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-center text-xs text-ink-soft">
                  <CalendarCheck className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
                  <span>
                    <span className="font-semibold text-ink">
                      {viewer === "guest" ? "You" : m.author_name || guestName || "Guest"}
                    </span>{" "}
                    {m.body.charAt(0).toLowerCase() + m.body.slice(1)}{" "}
                    <span className="text-ink-muted">· {format(parseISO(m.sent_at), "h:mm a")}</span>
                    {m.booking_id && bookingLink && <span className="mt-1 block">{bookingLink(m.booking_id)}</span>}
                  </span>
                </div>
              </div>
            ) : (
              <Bubble
                m={m}
                mine={mine}
                grouped={Boolean(grouped)}
                showMeta={lastOfGroup}
                name={m.author === "host" ? hostName : m.author_name || guestName || "Guest"}
                actions={mine && viewer === "host" ? actions : undefined}
              />
            )}
            {lastMine?.id === m.id && seen && (
              <p className="pr-1 text-right text-[11px] text-ink-muted">
                Seen {format(parseISO(otherSeenAt!), isToday(parseISO(otherSeenAt!)) ? "h:mm a" : "MMM d, h:mm a")}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Bubble({
  m,
  mine,
  grouped,
  showMeta,
  name,
  actions,
}: {
  m: Message;
  mine: boolean;
  grouped: boolean;
  showMeta: boolean;
  name: string;
  actions?: MessageActions;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [busy, setBusy] = useState(false);
  const unsent = Boolean(m.unsent_at);
  const problem = m.kind === "problem";

  return (
    <div className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row", grouped ? "mt-0.5" : "mt-3")}>
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
          showMeta ? "" : "invisible",
          m.author === "host" ? "bg-brand-700 text-sand-50" : "bg-sand-200 text-ink-soft",
        )}
        aria-hidden
      >
        {m.author === "host" ? <img src="/images/logo-192.png" alt="" className="size-7 rounded-full" /> : name.charAt(0)}
      </span>
      <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
        {!grouped && !mine && <span className="mb-1 px-1 text-[11px] text-ink-muted">{name}</span>}
        {editing ? (
          <div className="w-72 max-w-full rounded-2xl border border-sand-300 bg-white p-2 shadow-level-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setDraft(m.body))}>
                Cancel
              </Button>
              <Button
                size="sm"
                loading={busy}
                disabled={!draft.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await actions!.onEdit(m, draft.trim());
                    setEditing(false);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative flex items-center gap-1">
            {actions && !unsent && (
              <div className="relative order-first opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => setMenu((v) => !v)}
                  className="grid size-7 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100"
                  aria-label="Message options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
                    <div className="absolute right-0 bottom-full z-20 mb-1 w-36 overflow-hidden rounded-xl border border-sand-200 bg-white py-1 text-sm shadow-level-3">
                      {m.kind === "message" && (
                        <button
                          type="button"
                          onClick={() => (setMenu(false), setEditing(true))}
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-sand-100"
                        >
                          <Pencil className="size-3.5" /> Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          setMenu(false);
                          if (confirm("Unsend this message? The guest will see that a message was removed.")) {
                            await actions.onUnsend(m);
                          }
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-red-700 hover:bg-red-50"
                      >
                        <Undo2 className="size-3.5" /> Unsend
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed break-words whitespace-pre-wrap",
                unsent
                  ? "border border-dashed border-sand-300 bg-transparent text-ink-muted italic"
                  : problem
                    ? "border border-red-200 bg-red-50 text-red-900"
                    : mine
                      ? "bg-brand-700 text-sand-50"
                      : "bg-sand-100 text-ink",
                mine ? (grouped ? "rounded-tr-md" : "") : grouped ? "rounded-tl-md" : "",
              )}
            >
              {unsent ? (
                <span className="inline-flex items-center gap-1.5">
                  <Ban className="size-3.5" /> {mine ? "You unsent a message" : "This message was unsent"}
                </span>
              ) : (
                <>
                  {problem && (
                    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-red-700 uppercase">
                      <Siren className="size-3.5" /> Problem reported
                    </span>
                  )}
                  {m.body}
                </>
              )}
            </div>
          </div>
        )}
        {showMeta && !editing && (
          <span className="mt-1 px-1 text-[11px] text-ink-muted">
            {format(parseISO(m.sent_at), "h:mm a")}
            {m.edited_at && !unsent && " · Edited"}
          </span>
        )}
      </div>
    </div>
  );
}
