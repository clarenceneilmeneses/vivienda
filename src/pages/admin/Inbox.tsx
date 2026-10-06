import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isThisWeek, isToday, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUp,
  CalendarPlus,
  CheckCircle2,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailWarning,
  MessageSquareText,
  Phone,
  Plus,
  Search,
  Siren,
  Star,
  Trash2,
  UserRound,
  XCircle,
  Zap,
} from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { normalizeBooking, useSettings, useUnits } from "../../lib/queries";
import { isoDate, money, plural, prettyDate, stayRange } from "../../lib/format";
import { normalizeMessage, notifyMessage, useLiveTables } from "../../lib/guest";
import { SITE } from "../../lib/site";
import { cn } from "../../lib/utils";
import type { BookingSummary, Conversation, Message, QuickReply } from "../../lib/types";
import { Button, EmptyState, Field, Input, Modal, Spinner, StatusBadge, Textarea } from "../../components/ui";
import { MessageThread } from "../../components/MessageThread";
import { BookingDrawer } from "../../components/admin/BookingDrawer";
import { BookingForm } from "../../components/admin/BookingForm";

interface InboxGuest {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  created_at: string;
}
type Row = Conversation & { guest: InboxGuest };
type Filter = "all" | "unread" | "starred" | "archived";


function listTime(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isThisWeek(d)) return format(d, "EEE");
  return format(d, "MMM d");
}

export default function Inbox() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("c");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  useLiveTables("inbox", ["messages", "conversations"], [["inbox"]]);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["inbox", "list"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, guest:guests(id, full_name, email, phone, user_id, created_at)")
        .order("last_message_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Open (or start) the thread for a guest when sent here from a booking.
  const guestParam = params.get("guest");
  useEffect(() => {
    if (!guestParam || !rows) return;
    const found = rows.find((r) => r.guest_id === guestParam);
    const go = (id: string) => setParams({ c: id }, { replace: true });
    if (found) return go(found.id);
    void (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .upsert({ guest_id: guestParam, last_message_at: new Date().toISOString() }, { onConflict: "guest_id" })
        .select("id")
        .single();
      if (error) return toast.error(errorMessage(error));
      await qc.invalidateQueries({ queryKey: ["inbox"] });
      go(data.id);
    })();
  }, [guestParam, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const list = rows ?? [];
    const live = list.filter((r) => !r.archived_at);
    return {
      all: live.length,
      unread: live.filter((r) => r.admin_unread).length,
      starred: list.filter((r) => r.starred).length,
      archived: list.filter((r) => r.archived_at).length,
    };
  }, [rows]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? [])
      .filter((r) =>
        filter === "archived"
          ? r.archived_at
          : filter === "starred"
            ? r.starred
            : !r.archived_at && (filter === "all" || r.admin_unread),
      )
      .filter(
        (r) =>
          !term ||
          [r.guest.full_name, r.guest.email, r.guest.phone, r.last_message_preview].some((v) =>
            v?.toLowerCase().includes(term),
          ),
      );
  }, [rows, filter, q]);

  const selected = rows?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-3.75rem)] overflow-hidden bg-white sm:-mx-6 sm:-my-8 lg:h-[calc(100vh-1.5rem-3.75rem)]">
      {/* Conversation list */}
      <section
        className={cn(
          "flex w-full min-w-0 flex-col border-r border-sand-200 md:w-[340px] md:shrink-0",
          selected && "hidden md:flex",
        )}
      >
        <div className="border-b border-sand-200 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-medium text-ink">Messages</h1>
            <QuickRepliesButton />
          </div>
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
            {(
              [
                ["all", "All"],
                ["unread", "Unread"],
                ["starred", "Starred"],
                ["archived", "Archived"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                  filter === v ? "border-ink bg-ink text-white" : "border-sand-300 text-ink-soft hover:border-ink",
                )}
              >
                {label}
                {counts[v] > 0 && v !== "all" && <span className="ml-1 opacity-70">{counts[v]}</span>}
              </button>
            ))}
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests or messages" className="pl-9" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <Spinner />
          ) : error ? (
            <div className="p-6 text-sm text-ink-muted">
              <p className="font-medium text-red-700">The inbox isn't set up yet.</p>
              <p className="mt-1">
                Run the latest <code className="rounded bg-sand-100 px-1">supabase/schema.sql</code> in Supabase, then refresh.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <EmptyState icon={<InboxIcon />} title={filter === "all" ? "No messages yet" : "Nothing here"}>
              {filter === "all" ? "When guests message you from the website, the conversations land here." : undefined}
            </EmptyState>
          ) : (
            <ul>
              {shown.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setParams({ c: r.id })}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors",
                      r.id === selectedId ? "bg-sand-100" : "hover:bg-sand-50",
                    )}
                  >
                    <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-brand-700/10 font-semibold text-brand-700">
                      {r.guest.full_name.charAt(0).toUpperCase()}
                      {r.admin_unread && (
                        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-red-600" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm text-ink", r.admin_unread && "font-semibold")}>
                          {r.guest.full_name}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-muted">{listTime(r.last_message_at)}</span>
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 line-clamp-2 text-[13px]",
                          r.admin_unread ? "text-ink" : "text-ink-muted",
                        )}
                      >
                        {r.last_message_preview
                          ? `${r.last_author === "host" ? "You: " : ""}${r.last_message_preview}`
                          : "No messages yet"}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
                        {r.inquiry_check_in && r.inquiry_check_out && (
                          <span className="rounded-full bg-sand-100 px-2 py-0.5">
                            Inquiry · {stayRange(r.inquiry_check_in, r.inquiry_check_out)}
                          </span>
                        )}
                        {r.starred && <Star className="size-3 fill-amber-400 text-amber-400" />}
                        {!r.guest.user_id && <span title="No website account">No account</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Thread + details */}
      {selected ? (
        <ThreadPane key={selected.id} row={selected} onBack={() => setParams({})} />
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <EmptyState icon={<MessageSquareText />} title="Pick a conversation">
            Guests who message you from the website show up on the left. Replies reach them here and by email.
          </EmptyState>
        </div>
      )}
    </div>
  );
}

function ThreadPane({ row, onBack }: { row: Row; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const hostName = settings?.resort_name || SITE.name;
  const [draft, setDraft] = useState("");
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["inbox", "thread", row.id],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", row.id)
        .order("sent_at");
      if (error) throw error;
      return (data ?? []).map(normalizeMessage);
    },
  });

  // Opening a thread, or a new guest message arriving in it, marks it read.
  useEffect(() => {
    if (!row.admin_unread) return;
    void supabase
      .from("conversations")
      .update({ admin_unread: false, admin_seen_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(() => qc.invalidateQueries({ queryKey: ["inbox"] }));
  }, [row.id, row.admin_unread, row.last_message_at, qc]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, row.id]);

  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: row.id, author: "host", author_name: hostName, body });
      if (error) throw error;
      void notifyMessage("to_guest", row.id);
    },
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function patch(values: Partial<Conversation>, done?: string) {
    const { error } = await supabase.from("conversations").update(values).eq("id", row.id);
    if (error) return toast.error(errorMessage(error));
    await qc.invalidateQueries({ queryKey: ["inbox"] });
    if (done) toast.success(done);
  }

  const lastGuest = [...messages].reverse().find((m) => m.author === "guest");
  const firstName = row.guest.full_name.split(" ")[0] ?? "";

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-sand-200 px-3 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={onBack}
            className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-sand-100 md:hidden"
            aria-label="Back to messages"
          >
            <ArrowLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left xl:cursor-default"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700/10 text-sm font-semibold text-brand-700">
              {row.guest.full_name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{row.guest.full_name}</span>
              <span className="block truncate text-xs text-ink-muted">
                {row.guest_seen_at ? `Last read ${listTime(row.guest_seen_at)}` : row.guest.user_id ? "Guest" : "No website account"}
              </span>
            </span>
          </button>
          <IconToggle
            on={row.starred}
            label={row.starred ? "Unstar" : "Star"}
            onClick={() => patch({ starred: !row.starred })}
          >
            <Star className={cn("size-4", row.starred && "fill-amber-400 text-amber-400")} />
          </IconToggle>
          <IconToggle label="Mark as unread" onClick={() => patch({ admin_unread: true }, "Marked as unread")}>
            <MailWarning className="size-4" />
          </IconToggle>
          <IconToggle
            label={row.archived_at ? "Move to inbox" : "Archive"}
            onClick={() =>
              patch(
                { archived_at: row.archived_at ? null : new Date().toISOString() },
                row.archived_at ? "Moved to inbox" : "Archived",
              )
            }
          >
            {row.archived_at ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </IconToggle>
        </header>

        {!row.guest.user_id && (
          <p className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900">
            {firstName} has no website account, so they won't see replies here. Reach them by{" "}
            {row.guest.phone ? "phone" : ""}
            {row.guest.phone && row.guest.email ? " or " : ""}
            {row.guest.email ? "email" : ""}, or invite them to sign up with {row.guest.email || "their booking email"}.
          </p>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          {isLoading ? (
            <Spinner />
          ) : (
            <MessageThread
              messages={messages}
              viewer="host"
              hostName={hostName}
              guestName={row.guest.full_name}
              otherSeenAt={row.guest_seen_at}
              empty={`No messages with ${firstName} yet. Say hello.`}
              bookingLink={(id) => (
                <button
                  type="button"
                  onClick={() => setOpenBooking(id)}
                  className="cursor-pointer font-medium text-brand-700 underline underline-offset-2"
                >
                  Open booking
                </button>
              )}
              actions={{
                onEdit: async (m, body) => {
                  const { error } = await supabase
                    .from("messages")
                    .update({ body, edited_at: new Date().toISOString() })
                    .eq("id", m.id);
                  if (error) throw (toast.error(errorMessage(error)), error);
                  await qc.invalidateQueries({ queryKey: ["inbox", "thread", row.id] });
                },
                onUnsend: async (m) => {
                  const { error } = await supabase
                    .from("messages")
                    .update({ body: "", unsent_at: new Date().toISOString() })
                    .eq("id", m.id);
                  if (error) return void toast.error(errorMessage(error));
                  await qc.invalidateQueries({ queryKey: ["inbox"] });
                },
              }}
            />
          )}
        </div>

        <Composer
          draft={draft}
          setDraft={setDraft}
          textRef={textRef}
          sending={send.isPending}
          onSend={() => draft.trim() && send.mutate(draft.trim())}
          firstName={firstName}
          problem={lastGuest?.kind === "problem"}
        />
      </section>

      <DetailsPane
        row={row}
        open={showDetails}
        onClose={() => setShowDetails(false)}
        onOpenBooking={setOpenBooking}
        onCreate={() => setCreating(true)}
      />

      <BookingDrawer bookingId={openBooking} onClose={() => setOpenBooking(null)} />
      <CreateFromInquiry row={row} open={creating} onClose={() => setCreating(false)} onSaved={setOpenBooking} />
    </>
  );
}

function CreateFromInquiry({
  row,
  open,
  onClose,
  onSaved,
}: {
  row: Row;
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { data: units } = useUnits();
  const unit = units?.find((u) => u.is_active);
  return (
    <BookingForm
      open={open}
      onClose={onClose}
      onSaved={(id) => {
        onClose();
        onSaved(id);
      }}
      preset={{
        unitId: unit?.id,
        guestId: row.guest_id,
        checkIn: row.inquiry_check_in ?? undefined,
        checkOut: row.inquiry_check_out ?? undefined,
        guests: row.inquiry_guests ?? undefined,
        source: "website",
        status: "pending",
      }}
    />
  );
}

function IconToggle({
  on,
  label,
  onClick,
  children,
}: {
  on?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft hover:bg-sand-100 hover:text-ink"
    >
      {children}
    </button>
  );
}

function fill(template: string, firstName: string, resort: string) {
  return template.replaceAll("{guest}", firstName || "there").replaceAll("{resort}", resort);
}

function Composer({
  draft,
  setDraft,
  textRef,
  sending,
  onSend,
  firstName,
  problem,
}: {
  draft: string;
  setDraft: (v: string) => void;
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  sending: boolean;
  onSend: () => void;
  firstName: string;
  problem: boolean;
}) {
  const { data: settings } = useSettings();
  const { data: replies = [] } = useQuickReplies();
  const [open, setOpen] = useState(false);
  const resort = settings?.resort_name || SITE.name;

  return (
    <div className="border-t border-sand-200 px-3 pt-2 pb-3 sm:px-5">
      {problem && (
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <Siren className="size-3.5" /> The guest reported a problem during their stay
        </p>
      )}
      {replies.length > 0 && (
        <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
          {replies.slice(0, 6).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setDraft(fill(r.body, firstName, resort));
                textRef.current?.focus();
              }}
              className="shrink-0 cursor-pointer rounded-full border border-sand-300 px-3 py-1 text-xs text-ink-soft hover:border-brand-700 hover:text-brand-700"
            >
              {r.title}
            </button>
          ))}
        </div>
      )}
      <div className="relative flex items-end gap-1 rounded-3xl border border-sand-300 bg-white py-1.5 pr-1.5 pl-2 focus-within:border-ink/50">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-brand-700"
          aria-label="Quick replies"
          title="Quick replies"
        >
          <Zap className="size-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-80 overflow-y-auto rounded-2xl border border-sand-200 bg-white py-1.5 shadow-level-4">
              <p className="px-4 pt-1 pb-2 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">Quick replies</p>
              {replies.length === 0 && <p className="px-4 pb-3 text-sm text-ink-muted">None yet. Add some with Quick replies at the top.</p>}
              {replies.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setDraft(fill(r.body, firstName, resort));
                    setOpen(false);
                    textRef.current?.focus();
                  }}
                  className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-sand-100"
                >
                  <span className="block text-sm font-medium text-ink">{r.title}</span>
                  <span className="line-clamp-1 text-xs text-ink-muted">{fill(r.body, firstName, resort)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <textarea
          ref={textRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={`Reply to ${firstName || "guest"}…`}
          aria-label="Your reply"
          className="min-h-0 flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70 focus:outline-none"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!draft.trim() || sending}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-brand-700 text-white hover:bg-brand-700/90 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
      <p className="mt-1.5 px-2 text-[11px] text-ink-muted">Enter to send · Shift + Enter for a new line</p>
    </div>
  );
}

function DetailsPane({
  row,
  open,
  onClose,
  onOpenBooking,
  onCreate,
}: {
  row: Row;
  open: boolean;
  onClose: () => void;
  onOpenBooking: (id: string) => void;
  onCreate: () => void;
}) {
  const g = row.guest;
  const today = isoDate(new Date());
  const { data: bookings = [] } = useQuery({
    queryKey: ["inbox", "guest-bookings", g.id],
    queryFn: async (): Promise<BookingSummary[]> => {
      const { data, error } = await supabase
        .from("booking_summary")
        .select("*")
        .eq("guest_id", g.id)
        .order("check_in", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizeBooking);
    },
  });
  const { data: units } = useUnits();
  const unit = units?.find((u) => u.is_active);
  const inquiry = row.inquiry_check_in && row.inquiry_check_out ? row : null;
  const { data: inquiryFree } = useQuery({
    queryKey: ["inbox", "inquiry-free", unit?.id, row.inquiry_check_in, row.inquiry_check_out],
    enabled: Boolean(unit && inquiry && row.inquiry_check_out! > today),
    queryFn: async () => {
      const last = isoDate(new Date(parseISO(row.inquiry_check_out!).getTime() - 86_400_000));
      const { data, error } = await supabase.rpc("unavailable_nights", {
        p_unit: unit!.id,
        p_from: row.inquiry_check_in,
        p_to: last,
      });
      if (error) throw error;
      return ((data ?? []) as string[]).length === 0;
    },
  });
  const stays = bookings.filter((b) => b.status === "checked_out").length;
  const spent = bookings.reduce((s, b) => s + b.paid, 0);

  return (
    <aside
      className={cn(
        "min-h-0 w-[320px] shrink-0 overflow-y-auto border-l border-sand-200 bg-sand-50",
        open ? "fixed inset-y-0 right-0 z-40 block shadow-level-4 xl:static xl:shadow-none" : "hidden xl:block",
      )}
    >
      <div className="flex items-center justify-between border-b border-sand-200 bg-white px-5 py-3 xl:hidden">
        <p className="font-medium text-ink">Details</p>
        <button type="button" onClick={onClose} className="cursor-pointer text-sm text-ink-muted underline">
          Close
        </button>
      </div>
      <div className="space-y-6 p-5">
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-700 font-display text-2xl text-sand-50">
            {g.full_name.charAt(0).toUpperCase()}
          </span>
          <p className="mt-3 font-display text-lg text-ink">{g.full_name}</p>
          <p className="text-xs text-ink-muted">
            Guest since {prettyDate(g.created_at.slice(0, 10), "MMM yyyy")} · {plural(stays, "stay")}
            {spent > 0 && ` · ${money(spent, true)} paid`}
          </p>
          <div className="mt-3 space-y-1 text-sm">
            {g.email && (
              <a href={`mailto:${g.email}`} className="flex items-center justify-center gap-2 text-ink-soft hover:text-brand-700">
                <Mail className="size-3.5" /> {g.email}
              </a>
            )}
            {g.phone && (
              <a href={`tel:${g.phone.replace(/[^\d+]/g, "")}`} className="flex items-center justify-center gap-2 text-ink-soft hover:text-brand-700">
                <Phone className="size-3.5" /> {g.phone}
              </a>
            )}
            {!g.user_id && (
              <p className="flex items-center justify-center gap-2 text-xs text-amber-800">
                <UserRound className="size-3.5" /> No website account
              </p>
            )}
          </div>
        </div>

        {inquiry && (
          <div className="rounded-2xl border border-sand-200 bg-white p-4">
            <p className="eyebrow">Inquiry</p>
            <p className="mt-2 font-semibold text-ink">{stayRange(row.inquiry_check_in!, row.inquiry_check_out!)}</p>
            {row.inquiry_guests && <p className="text-sm text-ink-muted">{plural(row.inquiry_guests, "guest")}</p>}
            {row.inquiry_check_out! <= today ? (
              <p className="mt-2 text-xs text-ink-muted">These dates have passed.</p>
            ) : inquiryFree == null ? (
              <p className="mt-2 text-xs text-ink-muted">Checking the calendar…</p>
            ) : inquiryFree ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-800">
                <CheckCircle2 className="size-4" /> Available
              </p>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-700">
                <XCircle className="size-4" /> Already booked
              </p>
            )}
            {inquiryFree && (
              <Button size="sm" className="mt-3 w-full" onClick={onCreate}>
                <CalendarPlus className="size-4" /> Book these dates for {g.full_name.split(" ")[0]}
              </Button>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow">Bookings</p>
            <button type="button" onClick={onCreate} className="cursor-pointer text-xs font-medium text-brand-700 hover:underline">
              + New
            </button>
          </div>
          {bookings.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No bookings yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {bookings.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onOpenBooking(b.id)}
                    className="w-full cursor-pointer rounded-xl border border-sand-200 bg-white p-3 text-left hover:border-sand-300"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{stayRange(b.check_in, b.check_out)}</span>
                      <StatusBadge status={b.status} />
                    </span>
                    <span className="mt-1 flex justify-between text-xs text-ink-muted">
                      <span>
                        {b.ref} · {plural(b.guests_count, "guest")}
                      </span>
                      <span className={b.balance > 0.009 && b.status !== "cancelled" && b.status !== "declined" ? "text-terra-600" : ""}>
                        {b.balance > 0.009 ? `${money(b.balance, true)} due` : money(b.total, true)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

// ───────────────────────── quick replies ─────────────────────────

export function useQuickReplies() {
  return useQuery({
    queryKey: ["inbox", "quick-replies"],
    queryFn: async (): Promise<QuickReply[]> => {
      const { data, error } = await supabase.from("quick_replies").select("*").order("sort_order").order("created_at");
      if (error) return [];
      return (data ?? []) as QuickReply[];
    },
  });
}

function QuickRepliesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Zap className="size-3.5" /> Quick replies
      </Button>
      <QuickRepliesManager open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function QuickRepliesManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: replies = [] } = useQuickReplies();
  const [editing, setEditing] = useState<Partial<QuickReply> | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing?.title?.trim() || !editing.body?.trim()) return;
    setBusy(true);
    const values = { title: editing.title.trim(), body: editing.body.trim() };
    const { error } = editing.id
      ? await supabase.from("quick_replies").update(values).eq("id", editing.id)
      : await supabase.from("quick_replies").insert({ ...values, sort_order: replies.length });
    setBusy(false);
    if (error) return void toast.error(errorMessage(error));
    setEditing(null);
    await qc.invalidateQueries({ queryKey: ["inbox", "quick-replies"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this quick reply?")) return;
    const { error } = await supabase.from("quick_replies").delete().eq("id", id);
    if (error) return void toast.error(errorMessage(error));
    await qc.invalidateQueries({ queryKey: ["inbox", "quick-replies"] });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick replies"
      description="Saved answers you can drop into any conversation. {guest} becomes the guest's first name, {resort} the resort's name."
      size="lg"
    >
      {editing ? (
        <div className="space-y-4">
          <Field label="Title" hint="A short label, like “Payment details”.">
            {(id) => (
              <Input id={id} value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            )}
          </Field>
          <Field label="Message">
            {(id) => (
              <Textarea
                id={id}
                rows={6}
                value={editing.body ?? ""}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save} disabled={!editing.title?.trim() || !editing.body?.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-sand-200">
            {replies.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-3">
                <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 cursor-pointer text-left">
                  <span className="block text-sm font-medium text-ink">{r.title}</span>
                  <span className="line-clamp-2 text-xs text-ink-muted">{r.body}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="cursor-pointer rounded-md p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-700"
                  aria-label={`Delete ${r.title}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {replies.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">No quick replies yet.</li>}
          </ul>
          <Button className="mt-4" variant="secondary" onClick={() => setEditing({ title: "", body: "" })}>
            <Plus className="size-4" /> Add quick reply
          </Button>
        </>
      )}
    </Modal>
  );
}
