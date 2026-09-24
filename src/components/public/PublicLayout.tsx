import { Link, Outlet } from "react-router-dom";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useSettings } from "../../lib/queries";

export default function PublicLayout() {
  const { data: s } = useSettings();
  const name = s?.resort_name ?? "Vivienda";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-sand-200 bg-sand-50/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="font-display text-xl font-semibold text-forest-700">
            {name}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/#stay" className="hidden rounded-md px-3 py-2 text-ink-soft hover:text-ink sm:block">
              Stay
            </Link>
            <Link to="/my-booking" className="rounded-md px-3 py-2 text-ink-soft hover:text-ink">
              My booking
            </Link>
            <Link
              to="/book"
              className="ml-1 rounded-lg bg-forest-700 px-4 py-2 font-medium text-sand-50 hover:bg-forest-600"
            >
              Book now
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-sand-200 bg-sand-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-semibold text-forest-700">{name}</p>
            {s?.tagline && <p className="mt-1 text-sm text-ink-muted">{s.tagline}</p>}
          </div>
          <ul className="space-y-2 text-sm text-ink-soft">
            {s?.address && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                {s.map_url ? (
                  <a href={s.map_url} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
                    {s.address}
                  </a>
                ) : (
                  s.address
                )}
              </li>
            )}
            {s?.phone && (
              <li className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                <a href={`tel:${s.phone}`} className="hover:text-ink">
                  {s.phone}
                </a>
              </li>
            )}
            {s?.email && (
              <li className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                <a href={`mailto:${s.email}`} className="hover:text-ink">
                  {s.email}
                </a>
              </li>
            )}
          </ul>
          <div className="flex flex-col items-start gap-3 text-sm sm:items-end">
            {s?.facebook_url && (
              <a
                href={s.facebook_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-ink-soft hover:text-ink"
              >
                <MessageCircle className="size-4" /> Message us on Facebook
              </a>
            )}
            <p className="text-xs text-ink-muted">
              © {new Date().getFullYear()} {name} ·{" "}
              <Link to="/admin" className="hover:underline">
                Staff
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
