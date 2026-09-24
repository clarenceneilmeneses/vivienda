import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { SITE } from "../../lib/site";
import { Button, Spinner } from "../ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: "pending";
}

// Grouped the way Malaya OBS groups its sidebar.
const NAV: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    label: "Front desk",
    items: [
      { to: "/admin/bookings", label: "Bookings", icon: ClipboardList, badge: "pending" },
      { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/admin/guests", label: "Guests", icon: Users },
    ],
  },
  { label: "Money", items: [{ to: "/admin/finance", label: "Finance", icon: Wallet }] },
  {
    label: "Property",
    items: [
      { to: "/admin/units", label: "Rooms & rates", icon: BedDouble },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

const TITLES: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.to, i.label])));

const COLLAPSE_KEY = "vivienda:sidebar-collapsed";

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
      <img src="/images/logo-192.png" alt="" className="size-10 shrink-0 rounded-full ring-1 ring-cream/15" />
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-[15px] tracking-[0.18em] text-cream">VIVIENDA</span>
          <span className="block truncate text-[10px] tracking-[0.1em] text-cream/60 uppercase">Resort admin</span>
        </span>
      )}
    </Link>
  );
}

function NavList({ collapsed = false, onNavigate, pending }: { collapsed?: boolean; onNavigate?: () => void; pending: number }) {
  return (
    <nav className={cn("no-scrollbar flex flex-1 flex-col overflow-y-auto pb-4", collapsed ? "px-2" : "px-3")}>
      {NAV.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? (collapsed ? "mt-2" : "mt-5") : ""}>
          {collapsed ? (
            gi > 0 && <div className="mx-auto mb-2 h-px w-5 bg-espresso-soft" />
          ) : (
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-cream/45 uppercase">{group.label}</p>
          )}
          <div className="flex flex-col gap-1">
            {group.items.map(({ to, label, icon: Icon, end, badge }) => {
              const count = badge === "pending" ? pending : 0;
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center rounded-xl text-[15px] transition-colors",
                      collapsed ? "mx-auto size-10 justify-center" : "gap-3 px-3 py-2.5",
                      isActive
                        ? "bg-espresso-soft text-cream shadow-level-2"
                        : "text-cream/75 hover:bg-espresso-soft hover:text-cream",
                    )
                  }
                >
                  <Icon className="size-[18px] shrink-0 opacity-80 group-aria-[current=page]:opacity-100" />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {count > 0 &&
                    (collapsed ? (
                      <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-500 ring-2 ring-espresso" />
                    ) : (
                      <span
                        className="ml-auto rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white"
                        title={`${count} waiting`}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    ))}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { session, isAdmin, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { data: pending = 0 } = usePendingCount(Boolean(session && isAdmin));

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
          <Button variant="secondary" className="mt-5" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const email = session.user.email ?? "";
  const initials = email
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const title = TITLES[location.pathname.replace(/\/$/, "")] ?? "Dashboard";

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Desktop sidebar: a floating espresso card, as in Malaya OBS. */}
      <aside
        className={cn(
          "fixed inset-y-3 left-3 z-40 hidden flex-col overflow-hidden rounded-2xl bg-espresso shadow-level-2 transition-[width] duration-200 lg:flex",
          collapsed ? "w-[64px]" : "w-[248px]",
        )}
      >
        <div
          className={cn(
            "flex",
            collapsed ? "flex-col items-center gap-2 pt-4 pb-3" : "items-center justify-between gap-2 px-4 pt-5 pb-5",
          )}
        >
          <Wordmark compact={collapsed} />
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-cream/60 hover:bg-espresso-soft hover:text-cream"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <NavList collapsed={collapsed} pending={pending} />
        <SidebarFooter collapsed={collapsed} onSignOut={signOut} />
      </aside>

      {/* Phone drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-espresso/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[272px] flex-col bg-espresso">
            <div className="flex items-center justify-between px-4 pt-5 pb-5">
              <Wordmark />
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-cream/70 hover:bg-espresso-soft"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} pending={pending} />
            <SidebarFooter onSignOut={signOut} />
          </aside>
        </div>
      )}

      {/* The content sits in one white card with the same gutter as the sidebar. */}
      <div className={cn("transition-[padding] duration-200 lg:py-3 lg:pr-3", collapsed ? "lg:pl-[88px]" : "lg:pl-[272px]")}>
        <div className="flex min-h-screen flex-col lg:h-[calc(100vh-1.5rem)] lg:min-h-0 lg:overflow-hidden lg:rounded-2xl lg:bg-white lg:shadow-level-2">
          <header className="sticky top-0 z-30 border-b border-sand-200/80 bg-white/85 backdrop-blur-xl lg:static">
            <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
              <button
                onClick={() => setOpen(true)}
                className="grid size-9 place-items-center rounded-xl border border-sand-300 text-ink-soft lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </button>
              <nav aria-label="Breadcrumb" className="min-w-0 flex-1 text-[15px]">
                <span className="text-ink-muted">{SITE.name}</span>
                <span className="mx-1.5 text-ink-muted/60">/</span>
                <span className="font-medium text-ink">{title}</span>
              </nav>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-1.5 rounded-xl border border-sand-300 px-3 py-1.5 text-sm text-ink-soft hover:bg-sand-100 sm:inline-flex"
              >
                <ExternalLink className="size-3.5" /> View website
              </a>
              <span
                className="grid size-9 place-items-center rounded-full border border-sand-300 text-xs font-semibold text-brand-700"
                title={email}
              >
                {initials || "?"}
              </span>
            </div>
          </header>
          <main className="relative min-h-0 flex-1 bg-white lg:overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarFooter({ collapsed = false, onSignOut }: { collapsed?: boolean; onSignOut: () => void }) {
  return (
    <div className={cn("border-t border-espresso-soft py-3", collapsed ? "px-2" : "px-3")}>
      <button
        onClick={onSignOut}
        title={collapsed ? "Sign out" : undefined}
        aria-label="Sign out"
        className={cn(
          "flex w-full cursor-pointer items-center rounded-xl text-[15px] text-cream/75 transition-colors hover:bg-espresso-soft hover:text-cream",
          collapsed ? "mx-auto size-10 justify-center" : "gap-3 px-3 py-2.5",
        )}
      >
        <LogOut className="size-[18px] opacity-80" />
        {!collapsed && "Sign out"}
      </button>
    </div>
  );
}
