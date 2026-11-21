import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BedDouble, Grid3X3, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useUnavailableNights, useUnits } from "../../lib/queries";
import { isoDate, money, nightsBetween, prettyDate } from "../../lib/format";
import { GALLERY, LOCATION_LABEL, PHOTOS, PROMO, RECOMMEND, SITE } from "../../lib/site";
import { cn } from "../../lib/utils";
import { EmptyState } from "../../components/ui";
import { SearchPill, type StaySearch } from "../../components/public/SearchPill";
import { ReviewerAvatar, SourceLogo, TestimonialSection, toTestimonials } from "../../components/public/Reviews";
import { usePublishedReviews } from "../../lib/guest";
import { AmenityGrid, DriftGallery, StayFeature } from "../../components/public/HomeSections";
import type { Unit } from "../../lib/types";

/**
 * The landing page, 2026-11-21. Malaya's order (hero, the floating search,
 * the stay, the photos, the reviews) on Vivienda's own ground: a full-bleed
 * photograph to sell the place in one look, then sections in white, linen and
 * espresso that hand over to each other on soft curves. Short on purpose:
 * everything a guest needs to decide is above or one screen below the fold.
 */

const LINEN = "var(--color-linen)";
const ESPRESSO = "var(--color-espresso)";

export default function Home() {
  const { data: s } = useSettings();
  const { data: units, isLoading } = useUnits();
  const { data: published = [] } = usePublishedReviews();
  const testimonials = useMemo(() => toTestimonials(published), [published]);
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const [photosOpen, setPhotosOpen] = useState(false);
  // Vivienda is one resort, booked whole. It is the first active listing.
  const resort = (units ?? []).find((u) => u.is_active);
  const { data: taken } = useUnavailableNights(resort?.id, isoDate(new Date()), isoDate(new Date(Date.now() + 400 * 86_400_000)));

  // The search lives in the URL, so a result can be shared or come back to.
  const applied: StaySearch = {
    checkIn: params.get("in") ?? "",
    checkOut: params.get("out") ?? "",
    guests: Number(params.get("guests")) || 2,
    children: Number(params.get("kids")) || 0,
    pets: Number(params.get("pets")) || 0,
  };
  const [draft, setDraft] = useState<StaySearch>(applied);
  const searching = Boolean(applied.checkIn && applied.checkOut && applied.checkOut > applied.checkIn);
  const nights = searching ? nightsBetween(applied.checkIn, applied.checkOut) : 0;

  function runSearch() {
    const next = new URLSearchParams();
    if (draft.checkIn && draft.checkOut) {
      next.set("in", draft.checkIn);
      next.set("out", draft.checkOut);
    }
    next.set("guests", String(draft.guests));
    if (draft.children) next.set("kids", String(draft.children));
    if (draft.pets) next.set("pets", String(draft.pets));
    setParams(next, { replace: true });
    document.getElementById("stay")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // For a dated search: are those nights free, and what does the stay cost.
  const { data: check, isFetching: checking } = useQuery({
    queryKey: ["search", resort?.id, applied.checkIn, applied.checkOut, applied.guests, applied.pets],
    enabled: Boolean(resort && searching),
    queryFn: async () => {
      const u = resort!;
      const lastNight = isoDate(new Date(new Date(`${applied.checkOut}T00:00:00`).getTime() - 86_400_000));
      const [taken, quote] = await Promise.all([
        supabase.rpc("unavailable_nights", { p_unit: u.id, p_from: applied.checkIn, p_to: lastNight }),
        supabase.rpc("quote_stay", {
          p_unit: u.id,
          p_check_in: applied.checkIn,
          p_check_out: applied.checkOut,
          p_guests: Math.min(applied.guests, u.max_guests),
          p_pets: Math.min(applied.pets, u.max_pets),
        }),
      ]);
      if (taken.error) throw taken.error;
      if (quote.error) throw quote.error;
      return {
        free: ((taken.data ?? []) as string[]).length === 0,
        total: Number((quote.data as { total: number }[])[0]?.total ?? 0),
      };
    },
  });

  const stayHref = (u: Unit) => {
    const q = new URLSearchParams();
    if (searching) {
      q.set("in", applied.checkIn);
      q.set("out", applied.checkOut);
    }
    q.set("guests", String(Math.min(applied.guests, u.max_guests)));
    if (applied.children) q.set("kids", String(Math.min(applied.children, applied.guests - 1)));
    if (applied.pets && u.max_pets) q.set("pets", String(Math.min(applied.pets, u.max_pets)));
    return `/stay/${u.slug}?${q}`;
  };

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash, isLoading]);

  const promoOn = PROMO && PROMO.until >= isoDate(new Date());
  const facebook = s?.facebook_url || SITE.facebook;

  return (
    <>
      <Hero resort={resort} testimonials={testimonials} onPhotos={() => setPhotosOpen(true)} />

      {/* The search rides up onto the hero's lower edge, then sticks to the top
          as the page scrolls. Outside the hero: sticky is inert in overflow-hidden. */}
      <div className="pointer-events-none sticky top-0 z-20 -mt-12 -mb-12 px-4 pt-3 pb-3 sm:-mt-16 sm:-mb-14 sm:px-8 [&>*]:pointer-events-auto">
        <SearchPill
          value={draft}
          onChange={setDraft}
          onSearch={runSearch}
          limits={{
            max_guests: Math.max(resort?.max_guests ?? 2, 2),
            max_pets: resort?.max_pets ?? 0,
            pet_fee: resort?.pet_fee ?? 0,
          }}
          unavailable={taken}
        />
      </div>

      {/* ── The stay, on linen ── */}
      <section id="stay" className="scroll-mt-24 bg-linen px-4 pt-20 pb-14 sm:px-8 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-7xl">
          <Heading eyebrow="Booked whole, never shared" title="Your private haven" center />
          {isLoading ? (
            <div className="h-[420px] animate-pulse rounded-3xl bg-white/60" />
          ) : !resort ? (
            <EmptyState icon={<BedDouble />} title="Online booking opens soon">
              Call {s?.phone || SITE.phone} or message us on Facebook to reserve your stay.
            </EmptyState>
          ) : (
            <StayFeature
              about={s?.about}
              unit={resort}
              href={stayHref(resort)}
              search={
                searching
                  ? {
                      label: `${prettyDate(applied.checkIn, "MMM d")} – ${prettyDate(applied.checkOut, "MMM d")}`,
                      nights,
                      loading: checking,
                      free: check?.free ?? null,
                      total: check?.total ?? null,
                      tooMany: applied.guests > resort.max_guests,
                      onClear: () => {
                        setDraft({ ...applied, checkIn: "", checkOut: "" });
                        setParams({}, { replace: true });
                      },
                    }
                  : null
              }
            />
          )}

          <AmenityGrid checkIn={s?.check_in_time} checkOut={s?.check_out_time} />

          {promoOn && PROMO && (
            <div className="relative mt-8 overflow-hidden rounded-3xl bg-brand-700 text-sand-50 shadow-level-3">
              <img src={PHOTOS.poolAframe.src} alt="" className="absolute inset-0 size-full object-cover opacity-25" />
              <div className="absolute inset-0 bg-linear-to-r from-brand-800 via-brand-700/90 to-brand-700/30" />
              <div className="relative flex flex-col gap-6 p-7 sm:p-10 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <p className="inline-flex items-center gap-2 rounded-full bg-sand-50/15 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
                    <Sparkles className="size-3.5" /> {PROMO.title}
                  </p>
                  <h2 className="site-display mt-4 text-3xl leading-tight sm:text-4xl">{PROMO.headline}</h2>
                  <p className="mt-3 text-sm text-sand-50/85 sm:text-base">{PROMO.details}</p>
                </div>
                <div className="shrink-0 md:text-right">
                  <p className="text-xs tracking-[0.2em] text-sand-50/75 uppercase">Only</p>
                  <p className="font-display text-5xl leading-none sm:text-6xl">{PROMO.price}</p>
                  <p className="mt-2 text-xs text-sand-50/75">Weekdays · until {prettyDate(PROMO.until, "MMM d")}</p>
                  <a
                    href={facebook}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand-700 shadow-level-2 hover:bg-sand-100"
                  >
                    Book the promo <ArrowRight className="size-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── The photos, on white ── */}
      <Curve color={LINEN} edge="bottom" flip />
      <DriftGallery
        open={photosOpen}
        onOpen={() => setPhotosOpen(true)}
        onClose={() => setPhotosOpen(false)}
        heading={<Heading eyebrow="Inside one gate" title="A look around" />}
      />

      {/* ── The reviews, on espresso ── */}
      {testimonials.length > 0 && (
        <>
          <Curve color={ESPRESSO} />
          <section id="reviews" className="scroll-mt-20 bg-espresso px-4 pt-8 pb-14 sm:px-8 sm:pt-12 sm:pb-20">
            <div className="mx-auto max-w-7xl">
              <TestimonialSection testimonials={testimonials} tone="dark" />
              <div className="mt-14 flex flex-col items-start justify-between gap-5 border-t border-white/10 pt-10 sm:flex-row sm:items-center">
                <p className="site-display text-2xl leading-tight text-sand-50 sm:text-3xl">Your dates are waiting.</p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#stay"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-sand-50 px-7 text-sm font-semibold text-espresso transition-colors hover:bg-white"
                  >
                    Check availability <ArrowRight className="size-4" />
                  </a>
                  <a
                    href={facebook}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-sm font-medium text-sand-50 transition-colors hover:bg-white/10"
                  >
                    Message us on Facebook
                  </a>
                </div>
              </div>
            </div>
          </section>
          <Curve color={ESPRESSO} edge="bottom" flip />
        </>
      )}
    </>
  );
}

// ───────────────────────── pieces ─────────────────────────

/**
 * The hand-over between two grounds: one long, unhurried curve, the colour of
 * the section below rising into the one above. Not a wave pattern; one swell.
 */
function Curve({ color, edge = "top", flip = false, className }: { color: string; edge?: "top" | "bottom"; flip?: boolean; className?: string }) {
  // Drawn as the coloured section's own edge over a clear ground, so it meets
  // the paper (with its grain) without a seam. "top": the colour rises from
  // below; "bottom": it falls away into the page.
  return (
    <div aria-hidden className={cn("relative h-10 w-full sm:h-16 lg:h-20", edge === "top" ? "-mb-px" : "-mt-px", className)}>
      <svg
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        className={cn("absolute inset-0 size-full", flip && "-scale-x-100", edge === "bottom" && "-scale-y-100")}
      >
        <path d="M0 58 C 300 8, 620 4, 900 30 S 1300 74, 1440 22 L1440 80 L0 80 Z" fill={color} />
      </svg>
    </div>
  );
}

function Heading({ eyebrow, title, center }: { eyebrow: string; title: string; center?: boolean }) {
  return (
    <div className={cn("mb-7 sm:mb-10", center && "sm:text-center")}>
      <p className="brand-eyebrow text-[11px] text-ink-muted">{eyebrow}</p>
      <h2 className="site-display text-brand-heading mt-2 text-[1.9rem] leading-none sm:text-5xl">{title}</h2>
    </div>
  );
}

/**
 * The hero, on the same espresso ground as the reviews (2026-11-21: the owner
 * liked that section better than the photo hero). Cream type on the left with
 * the promise, the price and the proof; on the right the place in white-framed
 * photographs, and one guest's words on a card like the reviews' own. It ends
 * on a curve into the linen below, with the search riding that edge.
 */
function Hero({
  resort,
  testimonials,
  onPhotos,
}: {
  resort?: Unit;
  testimonials: ReturnType<typeof toTestimonials>;
  onPhotos: () => void;
}) {
  const faces = testimonials.slice(0, 5);
  const good = testimonials.filter((t) => (t.rating == null ? t.recommends : t.rating >= 4)).length;
  return (
    <section className="relative bg-espresso text-sand-50">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-10 pb-6 sm:px-8 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pt-16 lg:pb-10">
        <div>
          <p className="brand-eyebrow text-[11px] text-sand-50/60">
            Private pool resort <span className="mx-1.5 text-sand-50/30">·</span> {LOCATION_LABEL}
          </p>
          <h1 className="site-display mt-5 text-[2.6rem] leading-[1.02] text-sand-50 sm:text-6xl lg:text-[4.4rem]">
            The whole resort,
            <br />
            just for you.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-sand-50/75 sm:text-base">
            A glass A-frame, adult and kids pools, a garden and a pavilion
            {resort ? ` for up to ${resort.max_guests} guests` : ""}. Booked whole, never shared.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#stay"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-sand-50 px-7 text-sm font-semibold text-espresso transition-colors hover:bg-white"
            >
              Check availability <ArrowRight className="size-4" />
            </a>
            <button
              type="button"
              onClick={onPhotos}
              className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-white/25 px-6 text-sm font-medium text-sand-50 transition-colors hover:bg-white/10"
            >
              <Grid3X3 className="size-4" /> See all {GALLERY.length} photos
            </button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-white/10 pt-7">
            {faces.length > 0 && (
              <a href="#reviews" className="flex items-center gap-3">
                <span className="flex -space-x-3">
                  {faces.map((f) => (
                    <ReviewerAvatar key={f.id} name={f.author} url={f.avatarUrl} className="size-10 text-xs ring-2 ring-espresso" />
                  ))}
                </span>
                <span className="text-sm leading-tight">
                  <span className="block font-semibold text-sand-50">Loved by {good} guests</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-sand-50/65">
                    <SourceLogo source="facebook" className="size-3.5" /> {RECOMMEND.percent}% recommend
                  </span>
                </span>
              </a>
            )}
            {resort && (
              <p className="text-sm leading-tight text-sand-50/65">
                From
                <span className="block font-display text-2xl text-sand-50">
                  {money(resort.base_rate, true)}
                  <span className="font-sans text-sm text-sand-50/65"> / night</span>
                </span>
              </p>
            )}
          </div>
        </div>

        {/* The place, in white frames, with one guest's words beside it. */}
        <div className="relative pb-6 sm:pb-10">
          <div className="grid h-[320px] grid-cols-5 grid-rows-2 gap-3 sm:h-[460px] lg:h-[520px]">
            <Framed photo={PHOTOS.poolAframe} className="col-span-3 row-span-2" onClick={onPhotos} priority />
            <Framed photo={PHOTOS.billiards} className="col-span-2" onClick={onPhotos} />
            <Framed photo={PHOTOS.aframeLoft} className="col-span-2" onClick={onPhotos} />
          </div>
        </div>
      </div>

      {/* The hand-over to the linen below, and the search sits on it. */}
      <div className="bg-linen">
        <Curve color={ESPRESSO} edge="bottom" />
      </div>
    </section>
  );
}

/** A photograph in a white frame, the way the review cards sit on the espresso. */
function Framed({
  photo,
  className,
  onClick,
  priority,
}: {
  photo: { src: string; alt: string };
  className?: string;
  onClick: () => void;
  priority?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("group cursor-pointer overflow-hidden rounded-2xl bg-white p-1.5 shadow-level-4", className)}
    >
      <span className="block size-full overflow-hidden rounded-xl">
        <img
          src={photo.src}
          alt={photo.alt}
          fetchPriority={priority ? "high" : undefined}
          loading={priority ? undefined : "lazy"}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </span>
    </button>
  );
}

