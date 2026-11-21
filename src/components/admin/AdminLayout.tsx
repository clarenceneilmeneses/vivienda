import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  KeyRound,
  BedDouble,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { SITE } from "../../lib/site";
import { useInboxUnread, usePendingReviews } from "../../lib/admin-badges";
import { useLiveTables } from "../../lib/guest";
import { Button, Spinner } from "../ui";
import { PasswordModal } from "../PasswordModal";
import { AdminRangeProvider } from "../../lib/admin-range";
import { DateFilter } from "./DateFilter";

/**
 * The admin's frame, after Malaya OBS: a floating espresso sidebar with
 * foldable groups, a content card with a breadcrumb trail, sub-tab pills
 * under it for sections that have them (Settings), an account menu, and on
 * a phone a nav pill along the bottom with More for the rest.
 */

interface SubTab {
  to: string;
  label: string;
  icon: LucideIcon;
  hint: string;
}
interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: "pending" | "inbox" | "reviews";
  subTabs?: SubTab[];
}

const SETTINGS_TABS: SubTab[] = [
  { to: "/admin/settings", label: "General", icon: Building2, hint: "Name, contact details and location" },
  { to: "/admin/settings/booking-rules", label: "Booking rules", icon: CalendarClock, hint: "Stay times, downpayment and policies" },
  { to: "/admin/settings/payments", label: "Payments", icon: CreditCard, hint: "GCash and bank details shown at checkout" },
  { to: "/admin/settings/arrival-guide", label: "Arrival guide", icon: KeyRound, hint: "Check-in, wifi and house manual for confirmed guests" },
  { to: "/admin/settings/notifications", label: "Notifications", icon: Bell, hint: "Every email the system sends, with a switch on each" },
  { to: "/admin/settings/quick-replies", label: "Quick replies", icon: Zap, hint: "Saved answers for the Inbox" },
  { to: "/admin/settings/account", label: "Account & access", icon: ShieldCheck, hint: "Your password and who can open the admin" },
];

const NAV: { label: string; tabs: Tab[] }[] = [
  { label: "Overview", tabs: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Front desk",
    tabs: [
      { to: "/admin/inbox", label: "Inbox", icon: MessageSquare, badge: "inbox" },
      { to: "/admin/bookings", label: "Bookings", icon: ClipboardList, badge: "pending" },
      { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/admin/guests", label: "Guests", icon: Users },
      { to: "/admin/reviews", label: "Reviews", icon: Star, badge: "reviews" },
    ],
  },
  { label: "Money", tabs: [{ to: "/admin/finance", label: "Finance", icon: Wallet }] },
  {
    label: "Property",
    tabs: [
      { to: "/admin/units", label: "Resort & rates", icon: BedDouble },
      { to: "/admin/settings", label: "Settings", icon: Settings2, subTabs: SETTINGS_TABS },
    ],
  },
];

const ALL_TABS = NAV.flatMap((g) => g.tabs);
const PILL: string[] = ["/admin", "/admin/inbox", "/admin/bookings", "/admin/calendar"];

type Badges = Record<NonNullable<Tab["badge"]>, number>;

const COLLAPSE_KEY = "vivienda:sidebar-collapsed";
const GROUPS_KEY = "vivienda:nav-folded";

function isActive(to: string, pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  return to === "/admin" ? path === "/admin" : path === to || path.startsWith(`${to}/`);
}

function usePendingCount(enabled: boolean) {
  return useQuery({
    queryKey: ["bookings", "pending-count"],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/admin" className="flex min-w-0 items-center gap-3" aria-label="Dashboard">
      <img src="/images/logo-192.png" alt="" className="size-10 shrink-0 rounded-full ring-1 ring-sand-200" />
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-[15px] tracking-[0.18em] text-ink">VIVIENDA</span>
          <span className="block truncate text-[10px] tracking-[0.1em] text-ink-muted uppercase">Resort admin</span>
        </span>
      )}
    </Link>
  );
}

function Count({ n, collapsed }: { n: number; collapsed?: boolean }) {
  if (n <= 0) return null;
  return collapsed ? (
    <span className="absolute -top-1 -right-1 size-2 rounded-full bg-brand-500 ring-2 ring-white" />
  ) : (
    <span className="ml-auto shrink-0 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white" title={`${n} waiting`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function NavList({ collapsed = false, onNavigate, badges }: { collapsed?: boolean; onNavigate?: () => void; badges: Badges }) {
  const { pathname } = useLocation();
  const [folded, setFolded] = useState<string[]>([]);
  useEffect(() => {
    try {
      setFolded(JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "[]") as string[]);
    } catch {
      /* storage blocked */
    }
  }, []);
  const toggle = (label: string) =>
    setFolded((cur) => {
      const nextList = cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label];
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(nextList));
      } catch {
        /* ignore */
      }
      return nextList;
    });

  return (
    <nav className={cn("no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-6", collapsed ? "px-2" : "px-3")}>
      {NAV.map((group, gi) => {
        const hasActive = group.tabs.some((t) => isActive(t.to, pathname));
        const isFolded = !collapsed && folded.includes(group.label) && !hasActive;
        return (
          <div key={group.label} className={gi > 0 ? (collapsed ? "mt-2" : "mt-5") : ""}>
            {collapsed ? (
              gi > 0 && <div className="mx-auto mb-2 h-px w-5 bg-sand-200" />
            ) : (
              <button
                type="button"
                onClick={() => toggle(group.label)}
                aria-expanded={!isFolded}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-ink-muted/70 uppercase transition-colors hover:text-ink"
              >
                <ChevronRight className={cn("size-3 shrink-0 transition-transform", !isFolded && "rotate-90")} />
                {group.label}
              </button>
            )}
            {!isFolded && (
              <div className="flex flex-col gap-1">
                {group.tabs.map(({ to, label, icon: Icon, badge }) => {
                  const active = isActive(to, pathname);
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/admin"}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      aria-label={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center rounded-full text-[15px] transition-colors",
                        collapsed ? "mx-auto size-10 justify-center" : "gap-3 px-3 py-2",
                        active ? "bg-sand-100 font-medium text-brand-700" : "text-ink-soft hover:bg-sand-100/70 hover:text-ink",
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon className={cn("size-[18px]", active ? "opacity-100" : "opacity-80")} />
                        {collapsed && <Count n={badge ? badges[badge] : 0} collapsed />}
                      </span>
                      {!collapsed && <span className="truncate">{label}</span>}
                      {!collapsed && <Count n={badge ? badges[badge] : 0} />}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** A group of top-bar controls on one white, lifted, fully rounded strip (Malaya's TOP_PILL). */
const TOP_PILL = "flex items-center gap-0.5 rounded-full border border-sand-200/80 bg-white p-0.5 shadow-level-2";

function AccountMenu({ email, onSignOut, align = "right" }: { email: string; onSignOut: () => void; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const item = "flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-sand-100";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        title="Your account"
        aria-expanded={open}
        className="grid size-9 cursor-pointer place-items-center rounded-full bg-brand-700 text-sm font-semibold text-sand-50 ring-2 ring-white transition-shadow hover:shadow-level-2"
      >
        {email.charAt(0).toUpperCase() || "?"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={cn(
              "absolute top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-sand-200 bg-white py-1.5 shadow-level-4",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            <div className="border-b border-sand-200 px-4 pt-2 pb-3">
              <p className="truncate text-sm font-medium text-ink">Signed in</p>
              <p className="truncate text-xs text-ink-muted">{email}</p>
              <span className="mt-2 inline-flex rounded-full border border-brand-700/30 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                Owner
              </span>
            </div>
            <button type="button" onClick={() => (setOpen(false), setPwOpen(true))} className={item}>
              <UserRound className="size-4 text-ink-muted" /> Your account &amp; password
            </button>
            <Link to="/admin/settings" className={item}>
              <Settings2 className="size-4 text-ink-muted" /> Settings
            </Link>
            <div className="my-1 h-px bg-sand-200" />
            <button type="button" onClick={onSignOut} className={cn(item, "text-red-700 hover:bg-red-50")}>
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </>
      )}
      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

/** Today's date and the time in Manila, ticking each minute. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const fmt = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
  return <span className="hidden text-sm whitespace-nowrap text-ink-muted tabular-nums xl:inline">{fmt.format(now)}</span>;
}

/** The admin, inside the one date filter every screen reads. */
export default function AdminLayout() {
  return (
    <AdminRangeProvider>
      <AdminShell />
    </AdminRangeProvider>
  );
}

function AdminShell() {
  const { session, isAdmin, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const signedIn = Boolean(session && isAdmin);
  const { data: pending = 0 } = usePendingCount(signedIn);
  const { data: inbox = 0 } = useInboxUnread(signedIn);
  const { data: reviews = 0 } = usePendingReviews(signedIn);
  useLiveTables("admin-badges", ["conversations"], [["inbox", "unread-count"]], signedIn);
  const badges: Badges = { pending, inbox, reviews };

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage blocked; keep the default */
    }
  }, []);

  function toggle() {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  }

  if (loading) return <Spinner className="min-h-screen" />;
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-100 p-4">
        <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-level-3">
          <img src="/images/logo-192.png" alt="" className="mx-auto size-16 rounded-full" />
          <h1 className="mt-4 font-display text-2xl font-medium">No admin access</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {session.user.email} is signed in but isn't on the admin list. Add this email to the{" "}
            <code className="rounded bg-sand-100 px-1">admins</code> table in Supabase.
          </p>
          <Button variant="danger" className="mt-5" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const email = session.user.email ?? "";
  const path = location.pathname.replace(/\/$/, "");
  const tab = [...ALL_TABS].sort((a, b) => b.to.length - a.to.length).find((t) => isActive(t.to, path));
  const sub = tab?.subTabs?.find((s) => s.to === path);
  const fullBleed = path === "/admin/inbox";

  return (
    <div className="min-h-screen bg-sand-100 [--mobile-nav-space:calc(5.75rem+env(safe-area-inset-bottom))] lg:[--mobile-nav-space:0px]">
      {/* Desktop sidebar: a floating espresso card. */}
      <aside
        className={cn(
          "fixed inset-y-3 left-3 z-40 hidden flex-col overflow-hidden rounded-2xl border border-sand-200/80 bg-white shadow-level-2 transition-[width] duration-200 lg:flex",
          collapsed ? "w-[64px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex", collapsed ? "flex-col items-center gap-2 pt-4 pb-3" : "items-center justify-between gap-2 px-4 pt-5 pb-5")}>
          <Wordmark compact={collapsed} />
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand" : "Collapse"}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100 hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <NavList collapsed={collapsed} badges={badges} />
      </aside>

      {/* Phone drawer, opened from More on the nav pill. */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-espresso/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[272px] flex-col bg-white shadow-level-4">
            <div className="flex items-center justify-between px-4 pt-5 pb-5">
              <Wordmark />
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-ink-muted hover:bg-sand-100" aria-label="Close menu" title="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} badges={badges} />
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200 lg:py-3 lg:pr-3", collapsed ? "lg:pl-[88px]" : "lg:pl-[272px]")}>
        <div className="flex min-h-screen flex-col lg:h-[calc(100vh-1.5rem)] lg:min-h-0 lg:overflow-hidden lg:rounded-2xl lg:bg-white lg:shadow-level-2">
          <header className="sticky top-0 z-30 bg-sand-100/85 backdrop-blur-xl lg:static lg:bg-white/85">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:py-2">
              {/* Phone: you on the left, the date filter in a pill on the right, as in Malaya. */}
              <div className="lg:hidden">
                <AccountMenu email={email} onSignOut={() => void signOut()} align="left" />
              </div>
              <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block">
                <ol className="flex min-w-0 items-center gap-1.5 text-[15px]">
                  <li className="hidden text-ink-muted sm:block">{SITE.name}</li>
                  {tab && (
                    <li className="flex min-w-0 items-center gap-1.5">
                      <ChevronRight className="hidden size-3.5 shrink-0 text-ink-muted/60 sm:block" />
                      <Link
                        to={tab.to}
                        className={cn("truncate hover:underline", sub && sub.to !== tab.to ? "text-ink-muted" : "font-medium text-ink")}
                      >
                        {tab.label}
                      </Link>
                    </li>
                  )}
                  {sub && sub.to !== tab?.to && (
                    <li className="flex min-w-0 items-center gap-1.5">
                      <ChevronRight className="size-3.5 shrink-0 text-ink-muted/60" />
                      <span className="truncate font-medium text-ink">{sub.label}</span>
                    </li>
                  )}
                </ol>
              </nav>
              <LiveClock />
              <div className={cn(TOP_PILL, "ml-auto min-w-0 lg:ml-0")}>
                <DateFilter />
              </div>
              <div className="hidden lg:block">
                <AccountMenu email={email} onSignOut={() => void signOut()} />
              </div>
            </div>
            {tab?.subTabs && (
              <div className="px-4 pb-2 sm:px-6">
                <div className="no-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-sand-200/80 bg-white p-1 shadow-level-1">
                {tab.subTabs.map((s) => (
                  <NavLink
                    key={s.to}
                    to={s.to}
                    end
                    title={s.hint}
                    className={({ isActive: on }) =>
                      cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                        on ? "bg-sand-100 font-medium text-brand-700" : "text-ink-muted hover:bg-sand-100/60 hover:text-ink",
                      )
                    }
                  >
                    <s.icon className="size-3.5 shrink-0" aria-hidden />
                    {s.label}
                  </NavLink>
                ))}
                </div>
              </div>
            )}
          </header>
          <main className="relative min-h-0 flex-1 bg-white lg:overflow-y-auto">
            <div
              className={cn(
                fullBleed
                  ? "w-full pb-[var(--mobile-nav-space)] lg:h-full lg:pb-0"
                  : "mx-auto w-full max-w-[1400px] px-4 pt-6 pb-[calc(var(--mobile-nav-space)+1.5rem)] sm:px-6 sm:pt-8 lg:pb-8",
              )}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Phone nav pill: the four places you go most, and More for the rest. */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <nav
          aria-label="Main sections"
          className="relative flex items-stretch gap-0.5 rounded-full border border-sand-200 bg-white/90 p-1.5 shadow-level-3 backdrop-blur-xl"
        >
          {PILL.map((to) => {
            const t = ALL_TABS.find((x) => x.to === to)!;
            const on = isActive(to, path);
            const n = t.badge ? badges[t.badge] : 0;
            return (
              <Link
                key={to}
                to={to}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition-colors",
                  on ? "bg-sand-100 text-brand-700" : "text-ink-muted",
                )}
              >
                <span className="relative">
                  <t.icon className="size-[22px]" strokeWidth={on ? 2.2 : 1.8} />
                  {n > 0 && (
                    <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white">
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-1">{to === "/admin" ? "Home" : t.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium",
              !PILL.some((to) => isActive(to, path)) ? "bg-sand-100 text-brand-700" : "text-ink-muted",
            )}
          >
            <LayoutGrid className="size-[22px]" strokeWidth={1.8} />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
