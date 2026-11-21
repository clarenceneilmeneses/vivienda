import { useEffect, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  Clapperboard,
  Clock,
  CookingPot,
  Dices,
  Drumstick,
  Flame,
  Grid3X3,
  MapPin,
  Mic,
  Refrigerator,
  ThumbsUp,
  Tv,
  Users,
  Utensils,
  UtensilsCrossed,
  Waves,
  Wifi,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { money, prettyTime } from "../../lib/format";
import { GALLERY, LOCATION_LABEL, PHOTOS, RECOMMEND, SLEEPING, STAYS } from "../../lib/site";
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
 * The resort, said in pictures (2026-11-21: "filipinos are visuals and they
 * barely read"): the aerial view with the numbers on it, the two rooms as
 * photographs, the price and one button. No paragraph.
 */
export function StayFeature({ unit, href, search }: { unit: Unit; href: string; search: SearchState | null; about?: string }) {
  const booked = search?.free === false;
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
      <Link to={href} className="group relative block h-[340px] overflow-hidden rounded-[28px] shadow-level-3 sm:h-[460px] lg:col-span-7 lg:h-auto lg:min-h-[520px]">
        <img
          src={PHOTOS.aerial.src}
          alt={PHOTOS.aerial.alt}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/55 to-transparent" />
        <ul className="absolute right-4 bottom-4 left-4 flex flex-wrap gap-2">
          <Pill icon={Users}>Up to {unit.max_guests} guests</Pill>
          <Pill icon={Waves}>Adult & kids pools</Pill>
          <Pill icon={BedDouble}>{SLEEPING.length} rooms</Pill>
          <Pill icon={ThumbsUp}>{RECOMMEND.percent}% recommend</Pill>
        </ul>
      </Link>

      <div className="flex flex-col lg:col-span-5">
        <h3 className="site-display text-brand-heading text-3xl leading-tight sm:text-[2.4rem]">{unit.name}</h3>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-soft">
          <MapPin className="size-4 text-brand-700" /> {LOCATION_LABEL}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {ROOMS.map((r) => (
            <Link key={r.name} to={href} className="group overflow-hidden rounded-2xl bg-white shadow-level-2">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={r.photo} alt={r.name} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="px-3.5 py-3">
                <p className="site-display text-brand-heading text-[15px] leading-tight">{r.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                  <BedDouble className="size-3.5 shrink-0 text-brand-700" /> {r.beds}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-auto pt-7">
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
            <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
              <p className="text-sm text-ink-muted">
                From <span className="font-display text-4xl text-ink">{money(unit.base_rate, true)}</span> / night
              </p>
              {unit.weekend_rate && unit.weekend_rate !== unit.base_rate && (
                <p className="pb-1 text-sm text-ink-muted">{money(unit.weekend_rate, true)} Fri & Sat</p>
              )}
            </div>
          )}
          <Link
            to={href}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-700 text-sm font-semibold text-sand-50 shadow-level-2 transition-colors hover:bg-brand-700/90"
          >
            {search && !booked ? "Reserve these dates" : "See dates & book"} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-level-2 backdrop-blur sm:text-[13px]">
      <Icon className="size-3.5 text-brand-700" /> {children}
    </li>
  );
}

// Each fact-sheet amenity with its own small picture (the listing page uses these).
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
  [/smart tv|tv/i, Tv],
  [/netflix|youtube/i, Clapperboard],
];
export const amenityIcon = (a: string): LucideIcon => AMENITY_ICON.find(([re]) => re.test(a))?.[1] ?? CheckCircle2;

/** The two rooms, shown by their photographs. Bed counts from the fact sheet. */
export const ROOMS = [
  { name: "A-House", photo: PHOTOS.aframeLoft.src, beds: "2 double beds + sofa bed" },
  { name: "Stilt Room", photo: PHOTOS.bunkRoom.src, beds: "3 double-deck beds + sofa bed" },
];

/** What's inside the gate, as pictures with two or three words each. */
const INSIDE: { label: string; src: string; alt: string }[] = [
  { label: "Private pools", src: PHOTOS.poolWaterfall.src, alt: PHOTOS.poolWaterfall.alt },
  { label: "Billiards & games", src: PHOTOS.billiards.src, alt: PHOTOS.billiards.alt },
  { label: "Bonfire nights", src: "/images/stays/bonfire-night.jpg", alt: "Friends at the bonfire under the string lights" },
  { label: "Karaoke & Netflix", src: PHOTOS.aframeTv.src, alt: PHOTOS.aframeTv.alt },
  { label: "Kitchen", src: PHOTOS.kitchen.src, alt: PHOTOS.kitchen.alt },
  { label: "Garden & BBQ", src: PHOTOS.gardenUmbrellas.src, alt: PHOTOS.gardenUmbrellas.alt },
  { label: "Kids' play area", src: PHOTOS.playground.src, alt: PHOTOS.playground.alt },
  { label: "Event pavilion", src: PHOTOS.events.src, alt: PHOTOS.events.alt },
];

const EXTRAS: [LucideIcon, string][] = [
  [Wifi, "PLDT WiFi"],
  [Tv, "Smart TV"],
  [Refrigerator, "Refrigerator"],
  [CookingPot, "2-burner stove"],
  [Utensils, "Utensils"],
  [UtensilsCrossed, "Dining area"],
  [Dices, "Badminton & board games"],
];

/** What's inside: photo tiles first, the small things as one row of chips, the times. */
export function AmenityGrid({ checkIn, checkOut }: { checkIn?: string; checkOut?: string }) {
  return (
    <div className="mt-16 sm:mt-20">
      <h3 className="site-display text-brand-heading text-2xl leading-tight sm:text-3xl">What's inside</h3>
      <ul className="no-scrollbar -mx-4 mt-6 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0">
        {INSIDE.map((t) => (
          <li key={t.label} className="group relative aspect-[4/5] w-[46%] shrink-0 snap-start overflow-hidden rounded-2xl bg-sand-100 shadow-level-1 sm:w-auto">
            <img src={t.src} alt={t.alt} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/65 to-transparent" />
            <p className="absolute right-3 bottom-3 left-3 text-sm font-semibold text-white sm:text-[15px]">{t.label}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-6 flex flex-wrap gap-2">
        {EXTRAS.map(([Icon, label]) => (
          <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-ink shadow-level-1">
            <Icon className="size-3.5 text-brand-700" /> {label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-sand-50">
          <Clock className="size-3.5" /> In {prettyTime(checkIn || "14:00")} · Out {prettyTime(checkOut || "12:00")}
        </li>
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

/**
 * Recent stays: guests' own moments from the Facebook page, as a bento on a
 * computer and a row to swipe on a phone. The caption says what is happening,
 * never who.
 */
export function RecentStays({ heading }: { heading: ReactNode }) {
  const shape = (i: number) =>
    i === 0 ? "lg:col-span-2 lg:row-span-2" : i === 1 ? "lg:col-span-2" : "";
  return (
    <section id="stays" className="scroll-mt-24 px-4 pb-14 sm:px-8 sm:pb-20">
      <div className="mx-auto max-w-7xl">
        {heading}
        <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:auto-rows-[210px] lg:grid-cols-4 lg:gap-4">
          {STAYS.map((p, i) => (
            <li
              key={p.src}
              className={cn(
                "group relative h-72 w-[78%] shrink-0 snap-start overflow-hidden rounded-[22px] bg-sand-100 sm:h-64 sm:w-auto lg:h-auto",
                shape(i),
              )}
            >
              <img src={p.src} alt={p.alt} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/60 to-transparent" />
              <p className="absolute bottom-3.5 left-4 text-sm font-medium text-white">{p.caption}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
