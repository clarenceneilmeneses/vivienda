import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BedDouble,
  Check,
  CheckCircle2,
  Clock,
  Grid3X3,
  MapPin,
  Sparkles,
  Star,
  ThumbsUp,
  Users,
  Waves,
  Wifi,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useUnavailableNights, useUnits } from "../../lib/queries";
import { isoDate, money, nightsBetween, prettyDate, prettyTime } from "../../lib/format";
import { DEFAULT_AMENITIES, GALLERY, LOCATION_LABEL, PHOTOS, PROMO, RECOMMEND, REVIEWS, SITE, SLEEPING } from "../../lib/site";
import { cn } from "../../lib/utils";
import { EmptyState } from "../../components/ui";
import { AFrameMark, FrondBackdrop, GABLE, GABLE_LOW } from "../../components/public/decor";
import { SearchPill, type StaySearch } from "../../components/public/SearchPill";
import { averageRating, GuestReviewCard, ReviewCard, unitPhotos } from "../../components/public/StayBits";
import { usePublishedReviews, type PublishedReview } from "../../lib/guest";
import type { Unit } from "../../lib/types";

export default function Home() {
  const { data: s } = useSettings();
  const { data: units, isLoading } = useUnits();
  const { data: guestReviews = [] } = usePublishedReviews();
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
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
  return (
    <>
      {/* Hero. Malaya's grammar (tracked eyebrow, caps display, the pill under
          it) with Vivienda's own face: the glass A-frame. The photo sits in the
          gable's silhouette with its blueprint line behind it. */}
      <section className="relative overflow-hidden px-4 pt-6 pb-8 sm:px-8 sm:pt-12 lg:pt-14 lg:pb-12">
        <FrondBackdrop className="opacity-70" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <p className="brand-eyebrow inline-flex items-center gap-2.5 pl-[0.5em] text-[11px] text-ink sm:text-[12px] lg:pl-0">
              <AFrameMark className="text-brand-heading h-4 w-4" />
              Alitagtag <span className="text-ink/40">·</span> Batangas
            </p>
            <h1 className="site-display text-brand-heading mt-5 text-[2.75rem] leading-[0.95] sm:text-6xl lg:text-[5.25rem]">
              Our tropical
              <br />
              haven
            </h1>
            <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-ink-soft lg:mx-0">
              A glass A-frame, a private pool and a garden, all inside one gate. The whole resort is yours for the stay
              {resort ? `, up to ${resort.max_guests} guests` : ""}.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <a
                href="#stay"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-7 text-sm font-semibold text-sand-50 shadow-level-2 transition-colors hover:bg-brand-700/90"
              >
                Check dates & book <ArrowRight className="size-4" />
              </a>
              <a
                href="#day"
                className="inline-flex h-12 items-center rounded-full border border-sand-300 bg-white/70 px-6 text-sm font-medium text-ink transition-colors hover:bg-sand-100"
              >
                See a day here
              </a>
            </div>
            <dl className="mx-auto mt-9 grid max-w-md grid-cols-3 divide-x divide-sand-300/80 lg:mx-0">
              <HeroFact value={resort ? String(resort.max_guests) : "30"} label="Guests" />
              <HeroFact value="2" label="Pools" />
              <HeroFact value={`${RECOMMEND.percent}%`} label="Recommend" />
            </dl>
          </div>

          <AFrameHero />
        </div>
      </section>

      {/* The search, sticky. Outside the hero because sticky is inert inside overflow-hidden. */}
      <div className="pointer-events-none sticky top-0 z-20 px-4 pt-4 pb-3 sm:px-8 sm:pt-2 sm:pb-4 [&>*]:pointer-events-auto">
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

      <section id="stay" className="scroll-mt-24 px-4 py-6 sm:px-8 md:py-12">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="Booked whole, never shared" title="Your private haven" />
          {isLoading ? (
            <div className="h-[420px] animate-pulse rounded-3xl bg-sand-100" />
          ) : !resort ? (
            <EmptyState icon={<BedDouble />} title="Online booking opens soon">
              Call {s?.phone || SITE.phone} or message us on Facebook to reserve your stay.
            </EmptyState>
          ) : (
            <ResortCard
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
        </div>
      </section>

      <DayAtVivienda />

      <PhotoGallery />

      <IncludedBand checkIn={s?.check_in_time} checkOut={s?.check_out_time} facebook={s?.facebook_url || SITE.facebook} />

      {promoOn && PROMO && (
        <section className="px-4 pb-6 sm:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-700 text-sand-50 shadow-level-3">
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
                  href={s?.facebook_url || SITE.facebook}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand-700 shadow-level-2 transition-colors hover:bg-sand-100"
                >
                  Book the promo <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {REVIEWS.length + guestReviews.length > 0 && (
        <section id="reviews" className="scroll-mt-20 overflow-hidden py-16 sm:py-20">
          <div className="px-4 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <AFrameMark className="text-brand-heading mb-3 h-5 w-6" />
              <h2 className="site-display text-2xl leading-tight text-brand-700 sm:text-3xl">
                Loved by guests who stayed with us.
              </h2>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-ink">
                {guestReviews.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="size-4 fill-brand-700 text-brand-700" /> {averageRating(guestReviews)?.toFixed(2)} ·{" "}
                    {guestReviews.length} guest review{guestReviews.length === 1 ? "" : "s"}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <ThumbsUp className="size-4 text-brand-700" /> {RECOMMEND.percent}% recommend · {RECOMMEND.count} reviews
                  on Facebook
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <a
                href={s?.facebook_url || SITE.facebook}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-10 items-center rounded-full border border-sand-300 px-5 text-sm font-medium text-ink transition-colors hover:bg-sand-100"
              >
                Read them on Facebook
              </a>
              <Link
                to="/#stay"
                className="inline-flex h-10 items-center rounded-full bg-brand-700 px-6 text-sm font-medium text-sand-50 shadow-level-2 transition-colors hover:bg-brand-700/90"
              >
                Book Now
              </Link>
            </div>
          </div>
          </div>
          <ReviewMarquee guestReviews={guestReviews} />
        </section>
      )}
    </>
  );
}

/**
 * The reviews drift left on a loop and stop while hovered or focused. The list
 * is drawn twice so the loop has no seam; the copy is hidden from screen
 * readers. With reduced motion it is a plain scrollable row instead.
 */
function ReviewMarquee({ guestReviews }: { guestReviews: PublishedReview[] }) {
  // Reviews left on the site go first, then the Facebook recommendations.
  const items = [
    ...guestReviews.map((r) => ({ key: r.id, node: <GuestReviewCard review={r} /> })),
    ...REVIEWS.map((r) => ({ key: r.author, node: <ReviewCard {...r} /> })),
  ];
  const card = (r: (typeof items)[number], copy: boolean) => (
    <div key={`${copy ? "b" : "a"}-${r.key}`} className="w-[300px] shrink-0 sm:w-[360px]" aria-hidden={copy || undefined}>
      {r.node}
    </div>
  );
  return (
    <div className="marquee group relative mt-10 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div className="marquee-track flex w-max gap-5 py-2 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
        {items.map((r) => card(r, false))}
        {items.map((r) => card(r, true))}
      </div>
    </div>
  );
}


/** A bento of the best shots, and every photo one click away. */
function PhotoGallery() {
  const [open, setOpen] = useState(false);
  const shown = GALLERY.slice(0, 8);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <section id="gallery" className="scroll-mt-24 px-4 pt-4 pb-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <AFrameMark className="text-brand-heading mb-3 h-5 w-6" />
            <h2 className="site-display text-2xl leading-tight text-brand-700 sm:text-3xl">A look around.</h2>
            <p className="mt-2 max-w-lg text-sm text-ink-soft">
              The pool, the A-frame, the rooms, the garden and the pavilion — all inside one gate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-sand-300 px-5 text-sm font-medium text-ink hover:bg-sand-100"
          >
            <Grid3X3 className="size-4" /> See all {GALLERY.length} photos
          </button>
        </div>
        <div className="mt-6 grid auto-rows-[150px] grid-cols-2 gap-2 sm:auto-rows-[200px] sm:gap-3 lg:grid-cols-4">
          {shown.map((p, i) => (
            <button
              key={p.src}
              type="button"
              onClick={() => setOpen(true)}
              className={
                "group cursor-pointer overflow-hidden rounded-2xl bg-sand-100 " +
                (i === 0 ? "col-span-2 row-span-2" : i === 1 ? "row-span-2" : i === 5 ? "col-span-2 lg:col-span-1" : "")
              }
            >
              <img
                src={p.src}
                alt={p.alt}
                loading="lazy"
                className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white" role="dialog" aria-modal="true" aria-label="All photos">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sand-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
            <p className="font-medium text-ink">Vivienda · {GALLERY.length} photos</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-sand-100"
              aria-label="Close photos"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="mx-auto max-w-5xl columns-1 gap-3 px-4 py-6 sm:columns-2 sm:px-8">
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

interface SearchState {
  label: string;
  nights: number;
  loading: boolean;
  free: boolean | null;
  total: number | null;
  tooMany: boolean;
  onClear: () => void;
}

/** The one resort, as a feature: photo mosaic on the left, the facts and the price on the right. */
function ResortCard({ unit, href, search }: { unit: Unit; href: string; search: SearchState | null }) {
  const photos = unitPhotos(unit).slice(0, 3);
  const booked = search?.free === false;
  return (
    <div className="grid overflow-hidden rounded-3xl border border-sand-200/70 bg-white shadow-level-3 lg:grid-cols-[1.25fr_1fr]">
      <Link to={href} className="group grid h-72 grid-cols-3 grid-rows-2 gap-1.5 p-1.5 sm:h-[440px]">
        {photos.map((src, i) => (
          <div
            key={src}
            className={cn(
              "overflow-hidden bg-sand-100",
              i === 0 ? "col-span-2 row-span-2 rounded-l-[20px]" : i === 1 ? "rounded-tr-[20px]" : "rounded-br-[20px]",
            )}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        ))}
      </Link>

      <div className="flex flex-col p-6 sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-700 uppercase">The whole resort, just for you</p>
        <h2 className="site-display mt-3 text-3xl leading-tight text-brand-700 sm:text-4xl">{unit.name}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-brand-700" /> {LOCATION_LABEL}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ThumbsUp className="size-4 text-brand-700" /> {RECOMMEND.percent}% recommend
          </span>
        </p>

        <ul className="mt-6 grid gap-3 text-sm text-ink sm:grid-cols-2">
          <Fact icon={<Waves />}>Adult and kids pool, exclusive</Fact>
          <Fact icon={<Users />}>Up to {unit.max_guests} guests</Fact>
          {SLEEPING.map((r) => (
            <Fact key={r.room} icon={<BedDouble />}>
              {r.room}: {r.beds.slice(0, 2).join(", ")}
            </Fact>
          ))}
          <Fact icon={<Sparkles />}>Karaoke, billiards, bonfire, BBQ</Fact>
          <Fact icon={<Wifi />}>PLDT WiFi, Netflix & YouTube</Fact>
        </ul>

        <div className="mt-auto pt-8">
          {search ? (
            <div className="rounded-2xl bg-sand-100 p-4">
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
                  <CheckCircle2 className="size-4" /> Available ·{" "}
                  <span className="font-semibold">{money(search.total ?? 0, true)}</span> total
                </p>
              )}
              {search.tooMany && (
                <p className="mt-1 text-xs text-ink-muted">We fit up to {unit.max_guests}. Message us for bigger groups.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              From <span className="text-2xl font-semibold text-ink">{money(unit.base_rate, true)}</span> / night
            </p>
          )}
          <Link
            to={href}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 text-sm font-semibold text-sand-50 shadow-level-2 transition-colors hover:bg-brand-700/90"
          >
            {search && !booked ? "Reserve these dates" : "See dates & book"} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 text-brand-700 [&_svg]:size-4">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6 flex flex-col items-start sm:mb-9 sm:items-center sm:text-center">
      <AFrameMark className="text-brand-heading mb-3 h-5 w-6" />
      <p className="brand-eyebrow text-[11px] text-ink-soft">{eyebrow}</p>
      <h2 className="site-display text-brand-heading mt-2 text-[1.75rem] leading-none sm:text-5xl">{title}</h2>
    </div>
  );
}

function HeroFact({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 text-center lg:px-5 lg:text-left lg:first:pl-0">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-3xl leading-none text-brand-700">{value}</dd>
      <dd className="mt-1.5 text-[10px] font-semibold tracking-[0.2em] text-ink-muted uppercase">{label}</dd>
    </div>
  );
}

/**
 * The hero photo inside the A-frame's gable, the gable's outline drawn again
 * behind it like a blueprint line, and the pool in a porthole at the corner.
 */
function AFrameHero() {
  return (
    <div className="relative order-1 mx-auto w-full max-w-[15.5rem] sm:max-w-[26rem] lg:order-2 lg:max-w-[29rem]">
      {/* The blueprint line: the same gable, nudged down and right. */}
      <svg
        viewBox="0 0 100 120"
        preserveAspectRatio="none"
        aria-hidden
        className="text-brand-heading absolute inset-0 h-full w-full translate-x-3 translate-y-3 sm:translate-x-5 sm:translate-y-5"
      >
        <path d="M50 0.6 L99.4 52.8 V119.4 H0.6 V52.8 Z" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.55" />
      </svg>
      <div className="relative aspect-[5/6] overflow-hidden bg-sand-100" style={{ clipPath: GABLE }}>
        <img src={PHOTOS.poolAframe.src} alt={PHOTOS.poolAframe.alt} className="size-full object-cover object-[50%_20%]" fetchPriority="high" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/40 to-transparent" />
        <p className="absolute right-0 bottom-4 left-0 hidden text-center text-[10px] sm:block font-semibold tracking-[0.3em] text-white/90 uppercase">
          The glass A-frame
        </p>
      </div>
      <div className="absolute -bottom-3 -left-5 size-20 overflow-hidden rounded-full border-[5px] border-white bg-sand-100 shadow-level-3 sm:-left-6 sm:size-36">
        <img src={PHOTOS.poolWaterfall.src} alt="" className="size-full object-cover" />
      </div>
      <div className="absolute top-[48%] -right-8 rounded-2xl bg-white/95 px-3 py-2 sm:px-4 sm:py-3 shadow-level-3 backdrop-blur sm:-right-6">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Star className="size-4 fill-brand-700 text-brand-700" /> {RECOMMEND.percent}% recommend
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">{RECOMMEND.count} reviews on Facebook</p>
      </div>
    </div>
  );
}

const DAY = [
  {
    time: "Morning",
    title: "Wake up to the pool",
    body: "The adult and kids pools side by side, the waterfall running, and nobody else there.",
    photo: PHOTOS.poolWaterfall,
  },
  {
    time: "Midday",
    title: "A long lunch in the garden",
    body: "Picnic tables under the umbrellas, the BBQ griller going, a kitchen with a stove.",
    photo: PHOTOS.gardenUmbrellas,
  },
  {
    time: "Evening",
    title: "Karaoke, billiards, bonfire",
    body: "The pavilion by the pool keeps the party going, with a bonfire for the late talks.",
    photo: PHOTOS.billiards,
  },
  {
    time: "Night",
    title: "Lights out in the A-frame",
    body: "An air-conditioned loft under the glass, and the Stilt Room for the rest of the group.",
    photo: PHOTOS.aframeLoft,
  },
];

/** Vivienda's own section: one day here, morning to night, each photo under its own gable. */
function DayAtVivienda() {
  return (
    <section id="day" className="scroll-mt-24 px-4 pt-10 pb-14 sm:px-8 sm:pt-16">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="From the first swim to lights out" title="A day at Vivienda" />
        <ol className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {DAY.map((d, i) => (
            <li key={d.time} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <div className="group aspect-[4/5] overflow-hidden bg-sand-100" style={{ clipPath: GABLE_LOW }}>
                <img
                  src={d.photo.src}
                  alt={d.photo.alt}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <p className="mt-4 flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-brand-700 uppercase">
                <span className="tabular-nums">0{i + 1}</span>
                <span className="h-px w-6 bg-brand-700/40" />
                {d.time}
              </p>
              <h3 className="site-display text-brand-heading mt-2 text-xl leading-tight">{d.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{d.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Everything inside the gate, on the espresso of the brand, with the times. */
function IncludedBand({ checkIn, checkOut, facebook }: { checkIn?: string; checkOut?: string; facebook: string }) {
  return (
    <section className="px-4 pb-14 sm:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-espresso text-sand-50 shadow-level-3">
        <AFrameMark className="pointer-events-none absolute -right-16 -bottom-24 h-[26rem] w-[30rem] text-white/[0.05]" />
        <div className="relative grid gap-10 p-7 sm:p-10 lg:grid-cols-[1fr_1.6fr] lg:gap-14 lg:p-14">
          <div>
            <p className="brand-eyebrow text-[11px] text-sand-50/70">No add-ons to work out</p>
            <h2 className="site-display mt-3 text-3xl leading-tight sm:text-4xl">Everything inside the gate is yours</h2>
            <dl className="mt-7 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-sand-50/60" />
                <dt className="w-20 text-sand-50/70">Check-in</dt>
                <dd className="font-semibold">{prettyTime(checkIn || "14:00")}</dd>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-sand-50/60" />
                <dt className="w-20 text-sand-50/70">Check-out</dt>
                <dd className="font-semibold">{prettyTime(checkOut || "12:00")}</dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#stay"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-sand-50 px-6 text-sm font-semibold text-espresso transition-colors hover:bg-white"
              >
                Check dates <ArrowRight className="size-4" />
              </a>
              <a
                href={facebook}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 items-center rounded-full border border-sand-50/30 px-6 text-sm font-medium text-sand-50 transition-colors hover:bg-white/10"
              >
                Ask us on Facebook
              </a>
            </div>
          </div>
          <ul className="grid content-start gap-x-8 gap-y-3.5 text-[15px] sm:grid-cols-2">
            {DEFAULT_AMENITIES.map((a) => (
              <li key={a} className="flex items-start gap-3 border-b border-white/10 pb-3.5">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-100" />
                <span className="text-sand-50/90">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
