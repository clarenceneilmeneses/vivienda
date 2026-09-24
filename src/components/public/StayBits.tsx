import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Quote, Star } from "lucide-react";
import { photoUrl } from "../../lib/supabase";
import { money } from "../../lib/format";
import { GALLERY, LOCATION_LABEL, PHOTOS } from "../../lib/site";
import { cn } from "../../lib/utils";
import type { Unit } from "../../lib/types";

const FALLBACKS = [PHOTOS.poolAframe.src, PHOTOS.lounge.src, PHOTOS.garden.src, PHOTOS.trellis.src, PHOTOS.front.src];

/** A room's own photos first, then the rest of the property's, so a gallery is never short. */
export function unitPhotos(unit: Unit): string[] {
  const own = unit.photos.map(photoUrl);
  return [...own, ...GALLERY.map((p) => p.src).filter((p) => !own.includes(p))];
}

export interface StayItem {
  unit: Unit;
  /** Price for the searched nights, or null when not searching / unavailable. */
  total: number | null;
  nights: number;
  available: boolean;
}

/** Malaya's explore card: square photo, name, place, price. */
export function StayCard({ item, href, index = 0 }: { item: StayItem; href: string; index?: number }) {
  const { unit, total, nights, available } = item;
  const photo = unit.photos[0] ? photoUrl(unit.photos[0]) : FALLBACKS[index % FALLBACKS.length]!;
  return (
    <Link to={href} className="group block min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-sand-100">
        <img
          src={photo}
          alt={unit.name}
          loading="lazy"
          className={cn("size-full object-cover transition-transform duration-500 group-hover:scale-105", !available && "grayscale-[60%]")}
        />
        <span className="absolute top-3 left-3 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-ink shadow-level-1">
          {available ? `Sleeps ${unit.max_guests}` : "Booked those dates"}
        </span>
      </div>
      <div className="mt-2.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-700">{unit.name}</p>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-ink">
            <Star className="size-3.5 fill-ink" /> New
          </span>
        </div>
        <p className="truncate text-sm text-ink-muted">{LOCATION_LABEL}</p>
        <p className="mt-0.5 text-sm text-ink">
          {total != null ? (
            <>
              <span className="font-semibold">{money(total, true)}</span>
              <span className="text-ink-muted">
                {" "}
                for {nights} night{nights === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <>
              <span className="text-ink-muted">From </span>
              <span className="font-semibold">{money(unit.base_rate, true)}</span>
              <span className="text-ink-muted"> / night</span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
}

/** A titled horizontal strip of cards with a scroll arrow, as on Malaya's landing. */
export function StayRow({
  title,
  items,
  hrefFor,
}: {
  title: string;
  items: StayItem[];
  hrefFor: (u: Unit) => string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="site-display text-2xl leading-tight text-brand-700 sm:text-3xl">{title}</h2>
        {items.length > 2 && (
          <button
            type="button"
            aria-label={`Scroll ${title}`}
            onClick={() => {
              const el = strip.current;
              if (!el) return;
              const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
              el.scrollBy({ left: atEnd ? -el.scrollWidth : el.clientWidth * 0.9, behavior: "smooth" });
            }}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-sand-100 text-ink transition-colors hover:bg-brand-700/10 hover:text-brand-700"
          >
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-2 max-w-lg text-sm text-ink-soft">
        Tap a stay to see open dates, photos and an instant quote.
      </p>
      <div
        ref={strip}
        className="no-scrollbar -mx-6 mt-5 flex snap-x snap-mandatory scroll-pl-6 gap-3 overflow-x-auto px-6 pb-1 sm:-mx-8 sm:scroll-pl-8 sm:gap-4 sm:px-8 lg:mx-0 lg:scroll-pl-0 lg:px-0"
      >
        {items.map((item, i) => (
          <div key={item.unit.id} className="w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-64 md:w-72">
            <StayCard item={item} href={hrefFor(item.unit)} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("flex gap-0.5", className)} aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-3.5", i < value ? "fill-brand-700 text-brand-700" : "text-sand-300")} />
      ))}
    </span>
  );
}

export function ReviewCard({ author, month, rating, body }: { author: string; month: string; rating: number; body: string }) {
  return (
    <figure className="flex h-full flex-col rounded-xl border border-sand-200/60 bg-white p-6 shadow-level-1">
      <Quote className="size-6 rotate-180 fill-brand-700 text-brand-700" />
      <Stars value={rating} className="mt-3" />
      <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink-muted">{body}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-sand-200/60 pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700 font-display text-xs font-semibold text-sand-50">
          {author.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{author}</span>
          <span className="block truncate text-xs text-ink-muted">{month}</span>
        </span>
      </figcaption>
    </figure>
  );
}
