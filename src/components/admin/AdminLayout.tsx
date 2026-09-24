import { useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BedDouble,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useSettings } from "../../lib/queries";
import { cn } from "../../lib/utils";
import { Button, Spinner } from "../ui";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/guests", label: "Guests", icon: Users },
  { to: "/admin/finance", label: "Finance", icon: Wallet },
  { to: "/admin/units", label: "Rooms & rates", icon: BedDouble },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const { session, isAdmin, loading, signOut } = useAuth();
  const { data: settings } = useSettings();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (loading) return <Spinner className="min-h-screen" />;
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-semibold">No admin access</h1>
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

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link to="/admin" className="font-display mb-4 px-3 pt-2 text-lg font-semibold text-sand-50">
        {settings?.resort_name ?? "Vivienda"}
        <span className="block font-sans text-xs font-normal text-sand-100/60">Admin</span>
      </Link>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive ? "bg-sand-50/15 font-medium text-sand-50" : "text-sand-100/75 hover:bg-sand-50/10 hover:text-sand-50",
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
      <div className="mt-auto space-y-1 border-t border-sand-50/10 pt-3">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sand-100/75 hover:bg-sand-50/10 hover:text-sand-50"
        >
          <ExternalLink className="size-4" /> View website
        </a>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sand-100/75 hover:bg-sand-50/10 hover:text-sand-50"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-sand-100/60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-forest-700 lg:block">{sidebar}</aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sand-200 bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="-ml-2 rounded-md p-2 text-ink-soft" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <span className="font-display font-semibold text-forest-700">{settings?.resort_name ?? "Vivienda"}</span>
        <span className="w-9" />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-64 bg-forest-700">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 rounded-md p-1 text-sand-100/75"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="px-4 py-6 sm:px-6 lg:ml-60 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
