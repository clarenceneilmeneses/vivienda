import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUp, CalendarDays, ChevronRight, Loader2, Siren, X } from "lucide-react";
import { errorMessage } from "../../lib/supabase";
import { isoDate, plural, stayRange } from "../../lib/format";
import { useSettings } from "../../lib/queries";
import {
  splitTrips,
  useGuestMarkSeen,
  useGuestProfile,
  useGuestThread,
  useLiveTables,
  useMyTrips,
  useSendGuestMessage,
  type Inquiry,
} from "../../lib/guest";
import { SITE } from "../../lib/site";
import { cn } from "../../lib/utils";
import { MessageThread } from "../MessageThread";
import { StatusBadge } from "../ui";

const STARTERS = [
  "Hi! Are you available on my dates?",
  "How many guests can stay overnight?",
  "Can we bring our own food and drinks?",
  "How do we get there by car?",
];

/**
 * The guest's one conversation with the resort, with the composer under it.
 * The same component fills the chat panel and the full Messages page.
 */
export function Conversation({
  compact = false,
  inquiry: initialInquiry,
  className,
}: {
  compact?: boolean;
  inquiry?: Inquiry | null;
  className?: string;
}) {
  const { data: settings } = useSettings();
  const hostName = settings?.resort_name || SITE.name;
  const profile = useGuestProfile();
  const thread = useGuestThread();
  const trips = useMyTrips();
  const send = useSendGuestMessage();
  const { mutate: markSeen } = useGuestMarkSeen();
  useLiveTables("guest-thread", ["messages", "conversations"], [["guest", "thread"], ["guest", "unread"]], Boolean(profile.data));

  const [draft, setDraft] = useState("");
  const [about, setAbout] = useState<Inquiry | null>(initialInquiry ?? null);
  const [problem, setProblem] = useState(false);
  const inquiryKey = JSON.stringify(initialInquiry ?? null);
  useEffect(() => {
    const next = JSON.parse(inquiryKey) as Inquiry | null;
    if (next?.checkIn) setAbout(next);
  }, [inquiryKey]);

  const messages = thread.data?.messages ?? [];
  const conversation = thread.data?.conversation ?? null;
  const today = isoDate(new Date());
  const { upcoming } = splitTrips(trips.data ?? [], today);
  const next = upcoming[0];
  const inHouse = upcoming.find((t) => t.status === "checked_in");

  // Opening the thread, or a reply arriving while it is open, marks it seen.
  const lastHost = [...messages].reverse().find((m) => m.author === "host");
  const needsSeen = Boolean(
    lastHost && (!conversation?.guest_seen_at || conversation.guest_seen_at < lastHost.sent_at),
  );
  useEffect(() => {
    if (!needsSeen) return;
    const fire = () => document.visibilityState === "visible" && markSeen();
    fire();
    document.addEventListener("visibilitychange", fire);
    return () => document.removeEventListener("visibilitychange", fire);
  }, [needsSeen, lastHost?.id, markSeen]);

  // Follow the newest message.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, thread.isSuccess]);

  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  function submit(text = draft) {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate(
      { body, kind: problem ? "problem" : "message", inquiry: about },
      {
        onSuccess: () => {
          setDraft("");
          setAbout(null);
          if (problem) {
            setProblem(false);
            toast.success("Problem reported", { description: "We've been alerted and will reply here." });
          }
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  if (profile.error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ink-muted">
        {errorMessage(profile.error)}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "px-3 py-3" : "py-2")}>
        {next && (
          <Link
            to={`/trips/${next.ref}`}
            className="mb-3 flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-3 transition-colors hover:bg-sand-50"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-700/10 text-brand-700">
              <CalendarDays className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{stayRange(next.check_in, next.check_out)}</span>
              <span className="block truncate text-xs text-ink-muted">
                {next.ref} · {plural(next.guests_count, "guest")}
              </span>
            </span>
            <StatusBadge status={next.status} />
            <ChevronRight className="size-4 shrink-0 text-ink-muted" />
          </Link>
        )}

        {thread.isLoading || profile.isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink-muted">
            <Loader2 className="size-4 animate-spin" /> Loading your messages…
          </p>
        ) : thread.error ? (
          <p className="py-8 text-center text-sm text-red-700">We couldn't load your messages just now.</p>
        ) : messages.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <img src="/images/logo-192.png" alt="" className="mx-auto size-14 rounded-full shadow-level-2" />
            <p className="mt-3 font-display text-lg text-ink">Message {hostName}</p>
            <p className="mx-auto mt-1 max-w-[34ch] text-sm text-ink-muted">
              Ask about dates, rates, your group or the place. We usually reply within the day.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => (setDraft(s), textRef.current?.focus())}
                  className="cursor-pointer rounded-full border border-sand-300 px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-brand-700 hover:text-brand-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageThread
            messages={messages}
            viewer="guest"
            hostName={hostName}
            otherSeenAt={conversation?.admin_seen_at}
            bookingLink={(id) => {
              const t = trips.data?.find((x) => x.id === id);
              return t ? (
                <Link to={`/trips/${t.ref}`} className="font-medium text-brand-700 underline underline-offset-2">
                  View trip
                </Link>
              ) : null;
            }}
          />
        )}
      </div>

      <form
        className={cn("shrink-0", compact ? "border-t border-sand-200 p-3" : "pt-3")}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {problem ? (
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
              <Siren className="size-3.5" /> Reporting a problem during your stay
            </span>
            <button
              type="button"
              onClick={() => setProblem(false)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-ink-muted hover:bg-sand-100"
            >
              <X className="size-3.5" /> Cancel
            </button>
          </div>
        ) : about?.checkIn && about.checkOut ? (
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-muted">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              <span className="truncate">
                About <span className="font-medium text-ink">{stayRange(about.checkIn, about.checkOut)}</span>
                {about.guests ? ` · ${plural(about.guests, "guest")}` : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setAbout(null)}
              className="cursor-pointer rounded-full p-0.5 hover:bg-sand-100"
              aria-label="Not about these dates"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : inHouse ? (
          <button
            type="button"
            onClick={() => (setProblem(true), textRef.current?.focus())}
            className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            <Siren className="size-3.5" /> Report a problem at the resort
          </button>
        ) : null}

        <div
          className={cn(
            "flex items-end gap-1 rounded-3xl border bg-white py-1.5 pr-1.5 pl-4 focus-within:border-ink/50",
            problem ? "border-red-300" : "border-sand-300",
          )}
        >
          <textarea
            ref={textRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={problem ? "What's wrong, and where?" : "Write a message…"}
            aria-label="Your message"
            className="min-h-0 flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            className={cn(
              "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              problem ? "bg-red-600 hover:bg-red-700" : "bg-brand-700 hover:bg-brand-700/90",
            )}
            aria-label="Send"
          >
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
