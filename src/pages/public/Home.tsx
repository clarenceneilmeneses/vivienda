import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { BedDouble, Clock, Users } from "lucide-react";
import { photoUrl } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { money, prettyTime } from "../../lib/format";
import { EmptyState, Spinner } from "../../components/ui";
import type { Unit } from "../../lib/types";

export default function Home() {
  const { data: s } = useSettings();
  const { data: units, isLoading } = useUnits();
  const { hash } = useLocation();
  const active = (units ?? []).filter((u) => u.is_active);
  const hero = active.find((u) => u.photos.length)?.photos[0];

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash, isLoading]);

  return (
    <>
      <section className="relative overflow-hidden bg-forest-700 text-sand-50">
        {hero && (
          <img src={photoUrl(hero)} alt="" className="absolute inset-0 size-full object-cover opacity-45" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-forest-700/90 via-forest-700/30 to-transparent" />
        <div className="relative mx-auto flex min-h-[62vh] max-w-6xl flex-col justify-end px-4 pt-24 pb-14">
          <h1 className="font-display max-w-2xl text-4xl leading-tight font-semibold sm:text-6xl">
            {s?.resort_name ?? "Vivienda"}
          </h1>
          {s?.tagline && <p className="mt-3 max-w-xl text-lg text-sand-100/90">{s.tagline}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/book"
              className="rounded-lg bg-clay-500 px-6 py-3 font-medium text-white shadow-sm hover:bg-clay-600"
            >
              Check availability
            </Link>
            <a
              href="#stay"
              className="rounded-lg border border-sand-50/40 px-6 py-3 font-medium text-sand-50 hover:bg-sand-50/10"
            >
              See the rooms
            </a>
          </div>
        </div>
      </section>

      {s?.about && (
        <section className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="font-display text-xl leading-relaxed text-ink-soft sm:text-2xl">{s.about}</p>
        </section>
      )}

      <section id="stay" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
        <h2 className="font-display text-3xl font-semibold">Where you'll stay</h2>
        <p className="mt-1 text-ink-muted">Rates are per night. Pick a room to see open dates.</p>
        <div className="mt-8">
          {isLoading ? (
            <Spinner />
          ) : active.length === 0 ? (
            <EmptyState icon={<BedDouble className="size-8" />} title="Rooms are coming soon">
              We're setting things up. Message us on Facebook to book in the meantime.
            </EmptyState>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((u) => (
                <UnitCard key={u.id} unit={u} />
              ))}
            </div>
          )}
        </div>
      </section>

      {s && (
        <section className="border-t border-sand-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Clock className="size-4 text-clay-500" /> Check-in & check-out
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                Check-in from {prettyTime(s.check_in_time)}
                <br />
                Check-out by {prettyTime(s.check_out_time)}
              </p>
            </div>
            {s.house_rules && (
              <div>
                <h3 className="font-semibold">House rules</h3>
                <p className="mt-2 text-sm whitespace-pre-line text-ink-soft">{s.house_rules}</p>
              </div>
            )}
            {s.cancellation_policy && (
              <div>
                <h3 className="font-semibold">Cancellations</h3>
                <p className="mt-2 text-sm whitespace-pre-line text-ink-soft">{s.cancellation_policy}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function UnitCard({ unit }: { unit: Unit }) {
  const photo = unit.photos[0];
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white">
      <div className="aspect-[4/3] overflow-hidden bg-sand-100">
        {photo ? (
          <img
            src={photoUrl(photo)}
            alt={unit.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-muted">
            <BedDouble className="size-10" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-semibold">{unit.name}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
          <Users className="size-4" /> Up to {unit.max_guests} guests
        </p>
        {unit.description && <p className="mt-3 line-clamp-3 text-sm text-ink-soft">{unit.description}</p>}
        {unit.amenities.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {unit.amenities.slice(0, 6).map((a) => (
              <li key={a} className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs text-ink-soft">
                {a}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p>
            <span className="text-lg font-semibold">{money(unit.base_rate, true)}</span>
            <span className="text-sm text-ink-muted"> / night</span>
            {unit.weekend_rate != null && unit.weekend_rate !== unit.base_rate && (
              <span className="block text-xs text-ink-muted">{money(unit.weekend_rate, true)} Fri & Sat</span>
            )}
          </p>
          <Link
            to={`/book?unit=${unit.slug}`}
            className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-forest-600"
          >
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}
