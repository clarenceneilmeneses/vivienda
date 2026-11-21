import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { toast } from "sonner";
import { Ban, CalendarCheck, Copy, ImageOff, ImagePlus, MoreHorizontal, Pencil, Reply, Siren, Undo2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { REACTIONS, type Message } from "../lib/types";
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

/** What a message says in one line, for reply quotes. */
export function snippet(m: Pick<Message, "body" | "attachment_path" | "unsent_at">) {
  if (m.unsent_at) return "Unsent message";
  if (m.body) return m.body.length > 90 ? `${m.body.slice(0, 90)}…` : m.body;
  return m.attachment_path ? "📷 Photo" : "";
}

/**
 * A conversation drawn the way messaging apps draw one: your messages on the
 * right in brand brown, theirs on the left, a day line when the date changes,
 * consecutive messages grouped, and "Seen" under the last thing you sent once
 * the other side has opened it. Booking events sit in the middle as notes.
 *
 * Hover a message (or hold it on a phone) to reply to it, react, or copy it.
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
  onReply,
  onReact,
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
  onReply?: (m: Message) => void;
  /** null clears the viewer's reaction. */
  onReact?: (m: Message, emoji: string | null) => void;
}) {
  if (messages.length === 0) {
    return <div className="px-6 py-10 text-center text-sm text-ink-muted">{empty ?? "No messages yet."}</div>;
  }

  const byId = new Map(messages.map((m) => [m.id, m]));
  const lastMine = [...messages].reverse().find((m) => m.author === viewer && m.kind !== "booking");
  const seen = Boolean(lastMine && otherSeenAt && otherSeenAt >= lastMine.sent_at);
  const nameOf = (m: Message) => (m.author === "host" ? hostName : m.author_name || guestName || "Guest");

  return (
    <ol className="flex flex-col gap-1 px-1">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay = !prev || prev.sent_at.slice(0, 10) !== m.sent_at.slice(0, 10);
        const mine = m.author === viewer;
        const grouped =
          prev && !newDay && prev.author === m.author && prev.kind !== "booking" && !m.reply_to &&
          parseISO(m.sent_at).getTime() - parseISO(prev.sent_at).getTime() < 5 * 60_000;
        const lastOfGroup =
          !next || next.author !== m.author || next.kind === "booking" || Boolean(next.reply_to) ||
          next.sent_at.slice(0, 10) !== m.sent_at.slice(0, 10) ||
          parseISO(next.sent_at).getTime() - parseISO(m.sent_at).getTime() >= 5 * 60_000;
        const quoted = m.reply_to ? byId.get(m.reply_to) : undefined;

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
                viewer={viewer}
                grouped={Boolean(grouped)}
                showMeta={lastOfGroup}
                name={nameOf(m)}
                quoted={quoted ? { name: quoted.author === viewer ? "You" : nameOf(quoted), text: snippet(quoted) } : undefined}
                actions={mine && viewer === "host" ? actions : undefined}
                onReply={onReply}
                onReact={onReact}
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

/** A photo from the private chat bucket, through a short-lived signed link. */
export function ChatPhoto({ path, className }: { path: string; className?: string }) {
  const { data: url, isError } = useQuery({
    queryKey: ["chat-photo", path],
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("chat-photos").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (isError) {
    return (
      <span className={cn("flex h-32 w-48 items-center justify-center gap-1.5 rounded-xl bg-sand-100 text-xs text-ink-muted", className)}>
        <ImageOff className="size-4" /> Photo unavailable
      </span>
    );
  }
  if (!url) return <span className={cn("block h-40 w-56 animate-pulse rounded-xl bg-sand-100", className)} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="Photo" className={cn("max-h-72 w-auto max-w-full rounded-xl object-cover", className)} />
    </a>
  );
}

function Bubble({
  m,
  mine,
  viewer,
  grouped,
  showMeta,
  name,
  quoted,
  actions,
  onReply,
  onReact,
}: {
  m: Message;
  mine: boolean;
  viewer: "guest" | "host";
  grouped: boolean;
  showMeta: boolean;
  name: string;
  quoted?: { name: string; text: string };
  actions?: MessageActions;
  onReply?: (m: Message) => void;
  onReact?: (m: Message, emoji: string | null) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [busy, setBusy] = useState(false);
  const unsent = Boolean(m.unsent_at);
  const problem = m.kind === "problem";
  const reactions = m.reactions ?? {};
  const myReaction = reactions[viewer];
  const hasMenu = !unsent && (Boolean(onReply) || Boolean(onReact) || Boolean(m.body) || Boolean(actions));

  // Hold a message on a phone to open its menu, as in messaging apps.
  const hold = useRef<number | null>(null);
  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => cancelHold, []);

  async function copy() {
    setMenu(false);
    try {
      await navigator.clipboard.writeText(m.body);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy on this browser.");
    }
  }

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
          <div className={cn("relative flex items-center gap-1", mine ? "flex-row" : "flex-row-reverse")}>
            {hasMenu && (
              <div
                className={cn(
                  "relative opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                  menu && "opacity-100",
                )}
              >
                <button
                  type="button"
                  onClick={() => setMenu((v) => !v)}
                  className="grid size-7 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100"
                  aria-label="Message options"
                  title="Reply, react or copy"
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
                    <div
                      className={cn(
                        "absolute bottom-full z-20 mb-1 w-48 overflow-hidden rounded-xl border border-sand-200 bg-white py-1 text-sm shadow-level-3",
                        mine ? "right-0" : "left-0",
                      )}
                    >
                      {onReact && (
                        <div className="flex items-center justify-between border-b border-sand-200 px-2 pb-1.5 pt-0.5">
                          {REACTIONS.map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => (setMenu(false), onReact(m, myReaction === e ? null : e))}
                              className={cn(
                                "grid size-8 cursor-pointer place-items-center rounded-full text-lg transition-transform hover:scale-125",
                                myReaction === e && "bg-sand-100",
                              )}
                              aria-label={`React ${e}`}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                      {onReply && (
                        <MenuItem onClick={() => (setMenu(false), onReply(m))} icon={<Reply className="size-3.5" />}>
                          Reply
                        </MenuItem>
                      )}
                      {m.body && (
                        <MenuItem onClick={copy} icon={<Copy className="size-3.5" />}>
                          Copy text
                        </MenuItem>
                      )}
                      {actions && m.kind === "message" && m.body && (
                        <MenuItem onClick={() => (setMenu(false), setEditing(true))} icon={<Pencil className="size-3.5" />}>
                          Edit
                        </MenuItem>
                      )}
                      {actions && (
                        <MenuItem
                          danger
                          icon={<Undo2 className="size-3.5" />}
                          onClick={async () => {
                            setMenu(false);
                            if (confirm("Unsend this message? The guest will see that a message was removed.")) {
                              await actions.onUnsend(m);
                            }
                          }}
                        >
                          Unsend
                        </MenuItem>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <div
              onPointerDown={(e) => {
                if (!hasMenu || e.pointerType !== "touch") return;
                cancelHold();
                hold.current = window.setTimeout(() => {
                  setMenu(true);
                  navigator.vibrate?.(15);
                }, 450);
              }}
              onPointerUp={cancelHold}
              onPointerMove={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(e) => {
                if (!hasMenu) return;
                e.preventDefault();
                setMenu(true);
              }}
              className={cn(
                "relative rounded-2xl text-[14px] leading-relaxed break-words whitespace-pre-wrap [-webkit-touch-callout:none]",
                m.attachment_path && !m.body && !unsent ? "p-1" : "px-3.5 py-2",
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
                  {quoted && (
                    <span
                      className={cn(
                        "mb-1.5 block rounded-lg border-l-2 px-2 py-1 text-xs",
                        mine ? "border-sand-50/60 bg-white/10 text-sand-50/85" : "border-brand-700/50 bg-white/70 text-ink-soft",
                      )}
                    >
                      <span className="block font-semibold">{quoted.name}</span>
                      <span className="line-clamp-2">{quoted.text}</span>
                    </span>
                  )}
                  {problem && (
                    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-red-700 uppercase">
                      <Siren className="size-3.5" /> Problem reported
                    </span>
                  )}
                  {m.attachment_path && <ChatPhoto path={m.attachment_path} className={m.body ? "mb-1.5" : ""} />}
                  {m.body}
                </>
              )}
              {!unsent && (reactions.guest || reactions.host) && (
                <span
                  className={cn(
                    "absolute -bottom-3 flex items-center gap-0.5 rounded-full border border-sand-200 bg-white px-1.5 py-0.5 text-xs leading-none shadow-level-1",
                    mine ? "left-2" : "right-2",
                  )}
                >
                  {[reactions.guest, reactions.host]
                    .filter(Boolean)
                    .filter((e, i, a) => a.indexOf(e) === i)
                    .map((e) => (
                      <button
                        key={e}
                        type="button"
                        disabled={!onReact}
                        onClick={() => onReact && onReact(m, myReaction === e ? null : e!)}
                        className="cursor-pointer disabled:cursor-default"
                        title={myReaction === e ? "Remove your reaction" : undefined}
                      >
                        {e}
                      </button>
                    ))}
                  {reactions.guest && reactions.host && reactions.guest === reactions.host && (
                    <span className="text-[10px] text-ink-muted">2</span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}
        {showMeta && !editing && (
          <span className={cn("px-1 text-[11px] text-ink-muted", reactions.guest || reactions.host ? "mt-4" : "mt-1")}>
            {format(parseISO(m.sent_at), "h:mm a")}
            {m.edited_at && !unsent && " · Edited"}
          </span>
        )}
        {!showMeta && (reactions.guest || reactions.host) && <span className="h-3" />}
      </div>
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  danger,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left",
        danger ? "text-red-700 hover:bg-red-50" : "hover:bg-sand-100",
      )}
    >
      {icon} {children}
    </button>
  );
}

/** "Replying to …" over a composer, with a way out. */
export function ReplyBar({ name, text, onCancel }: { name: string; text: string; onCancel: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-brand-700 bg-sand-100 px-3 py-1.5 text-xs">
      <Reply className="size-3.5 shrink-0 text-brand-700" />
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-ink">Replying to {name}</span>
        <span className="block truncate text-ink-muted">{text}</span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer rounded-full px-1.5 text-ink-muted hover:bg-sand-200"
        aria-label="Cancel reply"
      >
        ✕
      </button>
    </div>
  );
}

/** Picks a photo to send. Calls back with the file; the caller uploads it with the message. */
export function PhotoButton({ onPick, disabled }: { onPick: (f: File) => void; disabled?: boolean }) {
  return (
    <label
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-brand-700",
        disabled && "pointer-events-none opacity-40",
      )}
      title="Send a photo"
    >
      <ImagePlus className="size-4" aria-hidden />
      <span className="sr-only">Send a photo</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 10 * 1024 * 1024) return void toast.error("That photo is over 10 MB.");
          onPick(f);
        }}
      />
    </label>
  );
}

/** Uploads a chat photo into the guest's folder of the private chat bucket. */
export async function uploadChatPhoto(guestId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${guestId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("chat-photos").upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Couldn't send the photo: ${error.message}`);
  return path;
}
