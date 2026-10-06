import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  Expand,
  Images,
  LogOut,
  MessageCircle,
  Search,
  ShieldCheck,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useGuestProfile, useGuestUnread, useIsGuest } from "../../lib/guest";
import { useSettings } from "../../lib/queries";
import { SITE } from "../../lib/site";
import { cn } from "../../lib/utils";
import { Conversation } from "./Conversation";
import { useGuestUi } from "./GuestContext";

/** Slides a bar away on the way down a page and back on the way up. */
export function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last.current;
      if (Math.abs(delta) < 8) return;
      setHidden(delta > 0 && y > 120);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

function UnreadDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] leading-[14px] font-semibold text-white",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * The header's account control. Signed out it is "Sign in"; signed in it is
 * the guest's initial, opening Trips, Messages, Profile and Sign out. The
 * owner, signed in, gets a way back to the admin instead.
 */
export function AccountMenu() {
  const { session, isAdmin, signOut } = useAuth();
  const { isGuest } = useIsGuest();
  const { signIn } = useGuestUi();
  const { data: profile } = useGuestProfile();
  const { data: unread = 0 } = useGuestUnread();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  if (!session) {
    return (
      <button
        type="button"
        onClick={() => signIn()}
        className="brand-caps cursor-pointer text-[15px] whitespace-nowrap text-brand-700 transition-opacity hover:opacity-70"
      >
        Sign in
      </button>
    );
  }

  const email = session.user.email ?? "";
  const name = profile?.full_name || (session.user.user_metadata?.full_name as string | undefined) || email;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  const item = "flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-sand-100";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Your account"
        aria-expanded={open}
        className="relative flex h-10 cursor-pointer items-center gap-2 rounded-full border border-sand-300 bg-white pr-1 pl-3 shadow-level-1 transition-shadow hover:shadow-level-2"
      >
        <span className="grid gap-[3px]" aria-hidden>
          <span className="block h-[2px] w-3.5 rounded bg-ink" />
          <span className="block h-[2px] w-3.5 rounded bg-ink" />
          <span className="block h-[2px] w-3.5 rounded bg-ink" />
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-brand-700 text-sm font-semibold text-sand-50">
          {initial}
        </span>
        <UnreadDot count={isGuest ? unread : 0} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-sand-200 bg-white py-1.5 shadow-level-4">
            <div className="border-b border-sand-200 px-4 pt-2 pb-3">
              <p className="truncate text-sm font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-ink-muted">{email}</p>
            </div>
            {isAdmin ? (
              <Link to="/admin" className={item}>
                <ShieldCheck className="size-4 text-brand-700" /> Open admin
              </Link>
            ) : (
              <>
                <Link to="/trips" className={item}>
                  <CalendarCheck className="size-4 text-brand-700" /> Trips
                </Link>
                <Link to="/messages" className={item}>
                  <MessageCircle className="size-4 text-brand-700" /> Messages
                  {unread > 0 && (
                    <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{unread}</span>
                  )}
                </Link>
                <Link to="/profile" className={item}>
                  <User className="size-4 text-brand-700" /> Profile
                </Link>
              </>
            )}
            <div className="my-1 h-px bg-sand-200" />
            <button type="button" onClick={() => void signOut()} className={item}>
              <LogOut className="size-4 text-ink-muted" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface Tab {
  key: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  match?: (path: string, hash: string) => boolean;
  badge?: number;
}

const STEP = 48; // a 44px tab plus the 4px gap
let settled: number | null = null;

/**
 * The phone's nav: a floating pill of icons, Airbnb's tabs for one resort.
 * Signed in, it is Explore, Trips, Messages and Profile. Signed out, Messages
 * still works (it asks you to sign in, then opens the chat). One brown circle
 * slides to the tab you tap, and the pill drops away while you scroll down.
 */
export function BottomNav() {
  const { session, isAdmin } = useAuth();
  const { isGuest } = useIsGuest();
  const { signIn } = useGuestUi();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const { data: unread = 0 } = useGuestUnread();
  const hidden = useHideOnScroll();

  const tabs: Tab[] = [
    { key: "explore", label: "Explore", icon: Search, to: "/", match: (p, h) => p === "/" && h !== "#gallery" },
    ...(isGuest
      ? [
          { key: "trips", label: "Trips", icon: CalendarCheck, to: "/trips", match: (p: string) => p.startsWith("/trips") },
          { key: "messages", label: "Messages", icon: MessageCircle, to: "/messages", badge: unread },
          { key: "profile", label: "Profile", icon: User, to: "/profile" },
        ]
      : isAdmin && session
        ? [{ key: "admin", label: "Admin", icon: ShieldCheck, to: "/admin" }]
        : [
            { key: "photos", label: "Photos", icon: Images, to: "/#gallery", match: (p: string, h: string) => p === "/" && h === "#gallery" },
            { key: "booking", label: "My booking", icon: CalendarCheck, to: "/my-booking" },
            {
              key: "messages",
              label: "Messages",
              icon: MessageCircle,
              onClick: () => signIn({ then: () => navigate("/messages") }),
            },
            { key: "signin", label: "Sign in", icon: User, onClick: () => signIn() },
          ]),
  ];

  const routed = tabs.findIndex((t) => (t.match ? t.match(pathname, hash) : t.to === pathname));
  const [tapped, setTapped] = useState<number | null>(null);
  useEffect(() => setTapped(null), [pathname, hash]);
  const active = tapped ?? routed;

  const [shown, setShown] = useState(() => settled ?? active);
  useEffect(() => {
    if (shown === active) {
      settled = active;
      return;
    }
    const f = requestAnimationFrame(() => setShown(active));
    return () => cancelAnimationFrame(f);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav
      aria-label="Site"
      inert={hidden}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden",
        hidden ? "translate-y-[calc(100%+2rem)]" : "translate-y-0",
      )}
    >
      <div className="pointer-events-auto relative flex items-center gap-1 rounded-full border border-sand-200 bg-white/95 p-1.5 shadow-level-4">
        <span
          aria-hidden
          onTransitionEnd={() => (settled = shown)}
          className={cn(
            "pointer-events-none absolute top-1.5 left-1.5 size-11 rounded-full bg-brand-700 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            shown < 0 ? "opacity-0" : "opacity-100",
          )}
          style={{ transform: `translateX(${Math.max(shown, 0) * STEP}px)` }}
        />
        {tabs.map((t, i) => {
          const cls = cn(
            "relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-300",
            i === shown ? "text-sand-50" : "text-ink-muted hover:text-brand-700",
          );
          const body = (
            <>
              <t.icon className="size-5" />
              <UnreadDot count={t.badge ?? 0} />
            </>
          );
          return t.to ? (
            <Link
              key={t.key}
              to={t.to}
              onClick={() => setTapped(i)}
              aria-label={t.label}
              title={t.label}
              aria-current={i === routed ? "page" : undefined}
              className={cls}
            >
              {body}
            </Link>
          ) : (
            <button key={t.key} type="button" onClick={t.onClick} aria-label={t.label} title={t.label} className={cls}>
              {body}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const CORNER = "fixed right-4 z-40 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6";

/**
 * The round Messages button in the corner of every guest page, and the chat
 * panel it opens. Signed out, it asks you to sign in first and then opens.
 */
export function MessagesFab({ raised = false }: { raised?: boolean }) {
  const { session, isAdmin } = useAuth();
  const { chatOpen, openChat, closeChat, inquiry, signIn } = useGuestUi();
  const { data: unread = 0 } = useGuestUnread();
  const { data: settings } = useSettings();
  const { pathname } = useLocation();
  useEffect(() => closeChat(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeChat();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, closeChat]);

  if (session && isAdmin) return null;
  const corner = cn(CORNER, raised && "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]");
  const fab =
    "grid size-14 cursor-pointer place-items-center rounded-full bg-brand-700 text-sand-50 shadow-level-4 transition-transform hover:scale-105 active:scale-95";

  if (!session) {
    return (
      <button type="button" className={cn(corner, fab)} aria-label="Message us" onClick={() => signIn({ then: () => openChat() })}>
        <MessageCircle className="size-6" />
      </button>
    );
  }

  return (
    <>
      {chatOpen && (
        <section
          aria-label="Messages"
          className="fixed inset-x-3 top-[max(4.5rem,12vh)] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-level-4 md:inset-x-auto md:top-auto md:right-6 md:bottom-24 md:h-[min(600px,calc(100vh-8rem))] md:w-[390px]"
        >
          <header className="flex items-center gap-3 border-b border-sand-200 bg-sand-50 px-4 py-3">
            <span className="relative">
              <img src="/images/logo-192.png" alt="" className="size-9 rounded-full" />
              <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-sand-50 bg-emerald-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base text-ink">{settings?.resort_name || SITE.name}</p>
              <p className="truncate text-xs text-ink-muted">Usually replies within the day</p>
            </div>
            <Link
              to="/messages"
              aria-label="Open the full Messages page"
              className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-ink"
            >
              <Expand className="size-4" />
            </Link>
            <button
              type="button"
              onClick={closeChat}
              aria-label="Close messages"
              className="grid size-8 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </header>
          <Conversation compact inquiry={inquiry} className="flex-1" />
        </section>
      )}
      <button
        type="button"
        onClick={() => (chatOpen ? closeChat() : openChat())}
        aria-label={chatOpen ? "Close messages" : unread ? `Messages, ${unread} unread` : "Messages"}
        aria-expanded={chatOpen}
        className={cn(corner, fab, chatOpen && "hidden md:grid")}
      >
        {chatOpen ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        <UnreadDot count={chatOpen ? 0 : unread} className="-top-1 -right-1" />
      </button>
    </>
  );
}
