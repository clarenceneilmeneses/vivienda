import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  Grid3X3,
  MapPin,
  Sparkles,
  ThumbsUp,
  Users,
  Waves,
  Wifi,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { isoDate, money, nightsBetween, prettyDate } from "../../lib/format";
import { GALLERY, LOCATION_LABEL, PHOTOS, PROMO, RECOMMEND, REVIEWS, SITE, SLEEPING } from "../../lib/site";
import { cn } from "../../lib/utils";
import { EmptyState } from "../../components/ui";
import { FrondBackdrop } from "../../components/public/decor";
import { SearchPill, type StaySearch } from "../../components/public/SearchPill";
import { ReviewCard, unitPhotos } from "../../components/public/StayBits";
import type { Unit } from "../../lib/types";

export default function Home() {
  const { data: s } = useSettings();
  const { data: units, isLoading } = useUnits();
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  // Vivienda is one resort, booked whole. It is the first active listing.
  const resort = (units ?? []).find((u) => u.is_active);

  // The search lives in the URL, so a result can be shared or come back to.
  const applied: StaySearch = {
    checkIn: params.get("in") ?? "",
    checkOut: params.get("out") ?? "",
    guests: Number(params.get("guests")) || 2,
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
    setParams(next, { replace: true });
    document.getElementById("stay")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // For a dated search: are those nights free, and what does the stay cost.
  const { data: check, isFetching: checking } = useQuery({
    queryKey: ["search", resort?.id, applied.checkIn, applied.checkOut, applied.guests],
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
    return `/stay/${u.slug}?${q}`;
  };

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash, isLoading]);

  const promoOn = PROMO && PROMO.until >= isoDate(new Date());
  return (
    <>
      {/* Hero: centred display serif on white with the frond, as on the Malaya landing. */}
      <section className="relative overflow-hidden px-4 pt-12 pb-10 text-center sm:px-8 sm:pt-20 sm:pb-14">
        <FrondBackdrop />
        <div className="relative mx-auto max-w-5xl">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-brand-700">
            ALITAGTAG <Dot /> BATANGAS <Dot /> PRIVATE POOL
          </p>
          <h1 className="site-display mx-auto mt-7 max-w-4xl text-[2.6rem] leading-[1.05] text-brand-700 sm:text-6xl lg:text-7xl">
            Book your
            <br />
            Vivienda getaway.
          </h1>
          <span className="mx-auto mt-7 block h-px w-11 bg-brand-700/30" aria-hidden />
          <p className="mt-6 font-display text-lg text-ink sm:text-xl">
            Looking for a private getaway with your family or tropa? This is it.
          </p>
        </div>
      </section>

      {/* The search, sticky. Outside the hero because sticky is inert inside overflow-hidden. */}
      <div className="pointer-events-none sticky top-0 z-20 px-4 pt-3 pb-3 sm:px-8 md:pt-2 md:pb-4 [&>*]:pointer-events-auto">
        <SearchPill value={draft} onChange={setDraft} onSearch={runSearch} maxGuests={Math.max(resort?.max_guests ?? 2, 2)} />
      </div>

      <section id="stay" className="scroll-mt-24 px-4 py-8 sm:px-8 md:py-14">
        <div className="mx-auto max-w-7xl">
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
                        setDraft({ checkIn: "", checkOut: "", guests: applied.guests });
                        setParams({}, { replace: true });
                      },
                    }
                  : null
              }
            />
          )}
        </div>
      </section>

      <PhotoGallery />

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

      {REVIEWS.length > 0 && (
        <section className="overflow-hidden py-16 sm:py-20">
          <div className="px-4 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="site-display text-2xl leading-tight text-brand-700 sm:text-3xl">
                Loved by guests who stayed with us.
              </h2>
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <ThumbsUp className="size-4 text-brand-700" /> {RECOMMEND.percent}% recommend · {RECOMMEND.count} reviews
                on Facebook
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
          <ReviewMarquee />
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
function ReviewMarquee() {
  const card = (r: (typeof REVIEWS)[number], copy: boolean) => (
    <div key={`${copy ? "b" : "a"}-${r.author}`} className="w-[300px] shrink-0 sm:w-[360px]" aria-hidden={copy || undefined}>
      <ReviewCard {...r} />
    </div>
  );
  return (
    <div className="marquee group relative mt-10 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div className="marquee-track flex w-max gap-5 py-2 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
        {REVIEWS.map((r) => card(r, false))}
        {REVIEWS.map((r) => card(r, true))}
      </div>
    </div>
  );
}

function Dot() {
  return <span className="mx-2 text-brand-700/60 sm:mx-3">•</span>;
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
