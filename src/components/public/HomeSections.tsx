import { useEffect, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  CookingPot,
  Dices,
  Drumstick,
  Flame,
  Grid3X3,
  MapPin,
  Mic,
  Refrigerator,
  Tv,
  Utensils,
  UtensilsCrossed,
  Waves,
  Wifi,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { money, prettyTime } from "../../lib/format";
import { DEFAULT_AMENITIES, GALLERY, LOCATION_LABEL, PHOTOS, RECOMMEND, SITE, SLEEPING } from "../../lib/site";
import { cn } from "../../lib/utils";
import type { Unit } from "../../lib/types";

export interface SearchState {
  label: string;
  nights: number;
  loading: boolean;
  free: boolean | null;
  total: number | null;
  tooMany: boolean;
  onClear: () => void;
}

/**
 * The resort, set like a magazine spread rather than a listing card: the place
 * in three photographs on the left; on the right its name, three numbers, the
 * two rooms and the price, with the answer to a dated search in the same spot.
 */
export function StayFeature({ unit, href, search, about }: { unit: Unit; href: string; search: SearchState | null; about?: string }) {
  const booked = search?.free === false;
  return (
    <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-14">
      <Link to={href} className="group grid h-[340px] grid-cols-6 grid-rows-6 gap-3 sm:h-[520px] lg:col-span-7">
        <Photo src={PHOTOS.aerial.src} alt={PHOTOS.aerial.alt} className="col-span-4 row-span-6 rounded-[28px]" />
        <Photo src={PHOTOS.poolWaterfall.src} alt={PHOTOS.poolWaterfall.alt} className="col-span-2 row-span-3 rounded-[22px]" />
        <Photo src={PHOTOS.aframeStairs.src} alt={PHOTOS.aframeStairs.alt} className="col-span-2 row-span-3 rounded-[22px]" />
      </Link>

      <div className="lg:col-span-5">
        <h3 className="site-display text-brand-heading text-3xl leading-tight sm:text-[2.6rem]">{unit.name}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-brand-700" /> {LOCATION_LABEL}
          </span>
          <span className="text-ink-muted/50">·</span>
          <span>{RECOMMEND.percent}% recommend</span>
        </p>

        <dl className="mt-7 grid grid-cols-3 divide-x divide-sand-300/70 border-y border-sand-300/70 py-5">
          <Stat value={String(unit.max_guests)} label="Guests" />
          <Stat value="2" label="Pools" />
          <Stat value={String(SLEEPING.length)} label="Rooms" />
        </dl>

        <p className="mt-6 line-clamp-4 text-[15px] leading-relaxed text-ink-soft">{about || unit.description || SITE.about}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SLEEPING.map((r) => (
            <div key={r.room} className="rounded-2xl bg-white/80 px-4 py-3.5 shadow-level-1">
              <p className="site-display text-brand-heading text-base">{r.room}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{r.beds.slice(0, 2).join(" · ")}</p>
            </div>
          ))}
        </div>

        <div className="mt-7">
          {search ? (
            <div className="rounded-2xl bg-white p-4 shadow-level-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">
                  {search.label} · {search.nights} night{search.nights === 1 ? "" : "s"}
                </p>
                <button
                  type="button"
                  onClick={search.onClear}
                  className="cursor-pointer text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
                >
                  Clear
                </button>
              </div>
              {search.loading || search.free === null ? (
                <p className="mt-1 text-sm text-ink-muted">Checking availability…</p>
              ) : booked ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-red-700">
                  <XCircle className="size-4" /> Already booked those dates. Try others.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-emerald-800">
                  <CheckCircle2 className="size-4" /> Available · <span className="font-semibold">{money(search.total ?? 0, true)}</span> total
                </p>
              )}
              {search.tooMany && <p className="mt-1 text-xs text-ink-muted">We fit up to {unit.max_guests}. Message us for bigger groups.</p>}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              From <span className="font-display text-3xl text-ink">{money(unit.base_rate, true)}</span> / night
              {unit.weekend_rate && unit.weekend_rate !== unit.base_rate ? ` · ${money(unit.weekend_rate, true)} Fri & Sat` : ""}
            </p>
          )}
          <Link
            to={href}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-700 text-sm font-semibold text-sand-50 shadow-level-2 transition-colors hover:bg-brand-700/90 sm:w-auto sm:px-9"
          >
            {search && !booked ? "Reserve these dates" : "See dates & book"} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Photo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden bg-sand-100 shadow-level-2", className)}>
      <img src={src} alt={alt} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 text-center">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-3xl leading-none text-brand-700">{value}</dd>
      <dd className="mt-1.5 text-[10px] font-semibold tracking-[0.2em] text-ink-muted uppercase">{label}</dd>
    </div>
  );
}

// The fact sheet's amenities, each with its own small picture.
const AMENITY_ICON: [RegExp, LucideIcon][] = [
  [/pool/i, Waves],
  [/karaoke/i, Mic],
  [/bonfire/i, Flame],
  [/bbq|grill/i, Drumstick],
  [/refrigerator|fridge/i, Refrigerator],
  [/stove/i, CookingPot],
  [/utensil/i, Utensils],
  [/dining/i, UtensilsCrossed],
  [/billiard|badminton|board/i, Dices],
  [/wifi/i, Wifi],
  [/smart tv|\btv\b/i, Tv],
  [/netflix|youtube/i, Clapperboard],
];
const iconFor = (a: string) => AMENITY_ICON.find(([re]) => re.test(a))?.[1] ?? CheckCircle2;

/** Everything inside the gate as small pictures with words, no boxes; the times beside them. */
export function AmenityGrid({ checkIn, checkOut }: { checkIn?: string; checkOut?: string }) {
  return (
    <div className="mt-16 border-t border-sand-300/60 pt-10 sm:mt-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="site-display text-brand-heading text-2xl leading-tight">Included in every stay</h3>
        <p className="text-sm text-ink-soft">
          Check-in {prettyTime(checkIn || "14:00")} <span className="text-ink-muted/50">·</span> Check-out {prettyTime(checkOut || "12:00")}
        </p>
      </div>
      <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
        {DEFAULT_AMENITIES.map((a) => {
          const Icon = iconFor(a);
          return (
            <li key={a} className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-2.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand-700 shadow-level-1">
                <Icon className="size-5" strokeWidth={1.6} />
              </span>
              <span className="text-sm leading-snug text-ink">{a}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Every photo, drifting: three rows slide past in turn, each the other way,
 * so the whole place goes by without a click. Paused under the pointer; still
 * (and scrollable) for anyone who asked their device for less motion. A tap
 * opens them all.
 */
export function DriftGallery({ open, onOpen, onClose, heading }: { open: boolean; onOpen: () => void; onClose: () => void; heading: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const rows = [0, 1, 2].map((r) => GALLERY.filter((_, i) => i % 3 === r));
  return (
    <section id="gallery" className="scroll-mt-24 pt-6 pb-12 sm:pt-8 sm:pb-16">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 sm:px-8">
        {heading}
        <button
          type="button"
          onClick={onOpen}
          className="mb-7 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-sand-300 px-5 text-sm font-medium text-ink hover:bg-sand-100 sm:mb-10"
        >
          <Grid3X3 className="size-4" /> See all {GALLERY.length} photos
        </button>
      </div>

      <div className="drift-group space-y-3 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] sm:space-y-4">
        {rows.map((row, r) => (
          <div key={r} className="drift-viewport overflow-hidden">
            <div
              className={cn("drift flex w-max", r % 2 === 1 && "drift-reverse")}
              style={{ "--drift": `${70 + r * 12}s` } as CSSProperties}
            >
              {[0, 1].map((copy) => (
                <ul key={copy} className="flex shrink-0 gap-3 pr-3 sm:gap-4 sm:pr-4" aria-hidden={copy === 1 || undefined}>
                  {row.map((p) => (
                    <li key={p.src} className="shrink-0">
                      <button
                        type="button"
                        tabIndex={copy === 1 ? -1 : undefined}
                        onClick={onOpen}
                        className="group block h-36 cursor-pointer overflow-hidden rounded-2xl bg-sand-100 sm:h-52 lg:h-60"
                      >
                        <img
                          src={p.src}
                          alt={copy === 1 ? "" : p.alt}
                          loading="lazy"
                          className="h-full w-auto max-w-none object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white" role="dialog" aria-modal="true" aria-label="All photos">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sand-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
            <p className="font-medium text-ink">Vivienda · {GALLERY.length} photos</p>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-sand-100"
              aria-label="Close photos"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="mx-auto max-w-6xl columns-1 gap-3 px-4 py-6 sm:columns-2 sm:px-8 lg:columns-3">
            {GALLERY.map((p) => (
              <figure key={p.src} className="mb-3 break-inside-avoid">
                <img src={p.src} alt={p.alt} loading="lazy" className="w-full rounded-xl" />
                <figcaption className="mt-1.5 text-xs text-ink-muted">{p.alt}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
