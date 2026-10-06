import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, ChevronRight, Lock, Luggage, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { splitTrips, useMyTrips, type Trip } from "../../lib/guest";
import { isoDate, money, plural, stayRange } from "../../lib/format";
import { errorMessage, photoUrl } from "../../lib/supabase";
import { PHOTOS } from "../../lib/site";
import { cn } from "../../lib/utils";
import { Button, EmptyState, ErrorBox, Spinner, StatusBadge, Tabs } from "../../components/ui";
import { useGuestUi } from "../../components/public/GuestContext";

/** Wraps a guest-only page: a sign-in prompt when signed out, a note for the owner. */
export function GuestOnly({ title, children }: { title: string; children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  const { signIn } = useGuestUi();
  if (loading) return <Spinner className="min-h-[50vh]" />;
  if (!session || isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-700/10 text-brand-700">
          {isAdmin ? <ShieldCheck className="size-6" /> : <Lock className="size-6" />}
        </span>
        <h1 className="site-display mt-5 text-3xl text-brand-700">{title}.</h1>
        {isAdmin ? (
          <>
            <p className="mt-3 text-ink-muted">You're signed in with the admin account. Guest pages are for guests.</p>
            <Link
              to="/admin"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-brand-700 px-6 text-sm font-semibold text-sand-50"
            >
              Open the admin
            </Link>
          </>
        ) : (
          <>
            <p className="mt-3 text-ink-muted">Sign in to see your trips, payments and messages with us.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="rounded-full" onClick={() => signIn()}>
                Sign in
              </Button>
              <Button size="lg" variant="secondary" className="rounded-full" onClick={() => signIn({ mode: "signup" })}>
                Create account
              </Button>
            </div>
            <p className="mt-6 text-sm text-ink-muted">
              Booked without an account?{" "}
              <Link to="/my-booking" className="font-medium text-ink underline underline-offset-4">
                Find it by reference
              </Link>
            </p>
          </>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

export default function Trips() {
  return (
    <GuestOnly title="Trips">
      <TripsBody />
    </GuestOnly>
  );
}

type View = "upcoming" | "past" | "cancelled";

function TripsBody() {
  const { data: trips = [], isLoading, error, profileError } = useMyTrips();
  const [view, setView] = useState<View>("upcoming");
  const groups = splitTrips(trips, isoDate(new Date()));
  const shown = groups[view];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-28 sm:px-8 sm:pt-12">
      <h1 className="site-display text-3xl text-brand-700 sm:text-4xl">Trips.</h1>
      <Tabs
        className="mt-6"
        value={view}
        onChange={setView}
        items={[
          { value: "upcoming", label: "Upcoming", count: groups.upcoming.length },
          { value: "past", label: "Past", count: groups.past.length },
          { value: "cancelled", label: "Cancelled", count: groups.cancelled.length },
        ]}
      />

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : error || profileError ? (
          <ErrorBox>{errorMessage(error || profileError)}</ErrorBox>
        ) : shown.length === 0 ? (
          view === "upcoming" ? (
            <div className="grid overflow-hidden rounded-3xl border border-sand-200 md:grid-cols-2">
              <div className="flex flex-col justify-center p-8">
                <Luggage className="size-9 text-brand-700" />
                <h2 className="mt-4 font-display text-2xl text-ink">No trips booked… yet!</h2>
                <p className="mt-2 text-sm text-ink-muted">
                  Time to dust off your bags and plan your next getaway with family or tropa.
                </p>
                <Link
                  to="/#stay"
                  className="mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-sand-50"
                >
                  Check dates <ArrowRight className="size-4" />
                </Link>
                {groups.past.length === 0 && (
                  <p className="mt-6 text-xs text-ink-muted">
                    Can't find a booking? It may be under another email.{" "}
                    <Link to="/my-booking" className="underline">
                      Look it up by reference
                    </Link>
                    .
                  </p>
                )}
              </div>
              <img src={PHOTOS.group.src} alt="" className="hidden h-full min-h-72 w-full object-cover md:block" />
            </div>
          ) : (
            <EmptyState icon={<CalendarCheck />} title={view === "past" ? "No past trips yet" : "Nothing cancelled"} />
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function tripPhoto(t: Pick<Trip, "unit_photo">) {
  return t.unit_photo ? photoUrl(t.unit_photo) : PHOTOS.poolWaterfall.src;
}

function TripCard({ trip: t }: { trip: Trip }) {
  const owing = t.balance > 0.009 && !["cancelled", "declined"].includes(t.status);
  const reviewable = t.status === "checked_out" && !t.review_rating;
  return (
    <Link
      to={`/trips/${t.ref}`}
      className="lift group flex overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-level-1"
    >
      <img src={tripPhoto(t)} alt="" className="w-28 shrink-0 object-cover sm:w-40" />
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold text-ink">{t.unit_name}</p>
          <StatusBadge status={t.status} />
        </div>
        <p className="mt-1 text-sm text-ink-soft">{stayRange(t.check_in, t.check_out)}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t.ref} · {plural(t.nights, "night")} · {plural(t.guests_count, "guest")}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
          <span className={cn("font-medium", owing ? "text-terra-600" : "text-ink-muted")}>
            {owing ? `${money(t.balance, true)} balance` : reviewable ? "Leave a review" : money(t.total, true)}
          </span>
          <ChevronRight className="size-4 text-ink-muted transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
