import { Link } from "react-router-dom";
import { ChevronRight, Clock, MapPin, Phone } from "lucide-react";
import { isoDate, money, plural, stayRange } from "../../lib/format";
import { splitTrips, useMyTrips } from "../../lib/guest";
import { useSettings } from "../../lib/queries";
import { SITE } from "../../lib/site";
import { StatusBadge } from "../../components/ui";
import { Conversation } from "../../components/public/Conversation";
import { GuestOnly, tripPhoto } from "./Trips";

export default function Messages() {
  return (
    <GuestOnly title="Messages">
      <MessagesBody />
    </GuestOnly>
  );
}

/**
 * The full Messages page: the conversation in the middle and, on a wide
 * screen, the trip it is about beside it, as Airbnb lays out its inbox.
 */
function MessagesBody() {
  const { data: settings } = useSettings();
  const { data: trips = [] } = useMyTrips();
  const { upcoming, past } = splitTrips(trips, isoDate(new Date()));
  const trip = upcoming[0] ?? past[0];
  const name = settings?.resort_name || SITE.name;
  const phone = settings?.phone || SITE.phone;

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-8 sm:pt-6">
      <div className="grid h-[calc(100dvh-4.5rem)] overflow-hidden border-sand-200 bg-white sm:h-[calc(100dvh-7rem)] sm:rounded-3xl sm:border sm:shadow-level-2 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col">
          <header className="flex items-center gap-3 border-b border-sand-200 px-4 py-3 sm:px-6">
            <span className="relative">
              <img src="/images/logo-192.png" alt="" className="size-10 rounded-full" />
              <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg text-ink">{name}</h1>
              <p className="truncate text-xs text-ink-muted">Your host · usually replies within the day</p>
            </div>
          </header>
          <Conversation className="flex-1 px-3 pb-28 sm:px-6 sm:pb-4 md:pb-4" />
        </div>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-sand-200 bg-sand-50 p-5 lg:block">
          {trip ? (
            <>
              <p className="eyebrow">{upcoming[0] ? "Your next trip" : "Your last trip"}</p>
              <Link to={`/trips/${trip.ref}`} className="group mt-3 block overflow-hidden rounded-2xl border border-sand-200 bg-white">
                <img src={tripPhoto(trip)} alt="" className="h-36 w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{stayRange(trip.check_in, trip.check_out)}</p>
                    <StatusBadge status={trip.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {trip.ref} · {plural(trip.guests_count, "guest")}
                  </p>
                  {trip.balance > 0.009 && !["cancelled", "declined"].includes(trip.status) && (
                    <p className="mt-2 text-sm font-medium text-terra-600">{money(trip.balance, true)} balance</p>
                  )}
                  <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                    Trip details <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </Link>
            </>
          ) : (
            <div className="rounded-2xl border border-sand-200 bg-white p-4 text-sm text-ink-soft">
              <p className="font-semibold text-ink">Planning a stay?</p>
              <p className="mt-1">Ask us anything, then book your dates.</p>
              <Link to="/#stay" className="mt-3 inline-block font-medium text-brand-700 underline underline-offset-4">
                Check availability
              </Link>
            </div>
          )}

          <div className="mt-6 space-y-3 text-sm text-ink-soft">
            <p className="eyebrow">About {name}</p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" /> {settings?.address || SITE.address}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="size-4 text-brand-700" /> Check-in {settings?.check_in_time ?? "14:00"} · out{" "}
              {settings?.check_out_time ?? "12:00"}
            </p>
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 hover:text-brand-700">
              <Phone className="size-4 text-brand-700" /> {phone}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
