import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, BedDouble, Grid3X3, Sparkles, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { isoDate, nightsBetween, prettyDate } from "../../lib/format";
import { GALLERY, PHOTOS, PROMO, REVIEWS, SITE } from "../../lib/site";
import { EmptyState } from "../../components/ui";
import { FrondBackdrop } from "../../components/public/decor";
import { SearchPill, type StaySearch } from "../../components/public/SearchPill";
import { ReviewCard, StayCard, StayRow, type StayItem } from "../../components/public/StayBits";
import type { Unit } from "../../lib/types";

export default function Home() {
  const { data: s } = useSettings();
  const { data: units, isLoading } = useUnits();
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const active = useMemo(() => (units ?? []).filter((u) => u.is_active), [units]);
  const maxGuests = active.reduce((n, u) => Math.max(n, u.max_guests), 2);

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

  // For a dated search: each stay's taken nights and its server-side price.
  const checks = useQueries({
    queries: active.map((u) => ({
      queryKey: ["search", u.id, applied.checkIn, applied.checkOut, applied.guests],
      enabled: searching,
      queryFn: async () => {
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
    })),
  });

  const items: StayItem[] = active
    .map((u, i) => {
      const c = checks[i]?.data;
      const available = !searching || (c?.free ?? true);
      return { unit: u, nights, available, total: searching && c && available ? c.total : null };
    })
    .filter((it) => it.unit.max_guests >= applied.guests)
    .sort((a, b) => Number(b.available) - Number(a.available));

  const hrefFor = (u: Unit) => {
    const q = new URLSearchParams();
    if (searching) {
      q.set("in", applied.checkIn);
      q.set("out", applied.checkOut);
    }
    q.set("guests", String(applied.guests));
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
        <SearchPill value={draft} onChange={setDraft} onSearch={runSearch} maxGuests={Math.max(maxGuests, 2)} />
      </div>

      <section id="stay" className="scroll-mt-24 px-6 py-8 sm:px-8 md:py-14">
        <div className="mx-auto max-w-7xl">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl bg-sand-100" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <EmptyState icon={<BedDouble />} title="Online booking opens soon">
              Call {s?.phone || SITE.phone} or message us on Facebook to reserve your stay.
            </EmptyState>
          ) : searching ? (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="site-display text-2xl text-brand-700 sm:text-3xl">
                  {prettyDate(applied.checkIn, "MMM d")} – {prettyDate(applied.checkOut, "MMM d")}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setDraft({ checkIn: "", checkOut: "", guests: applied.guests });
                    setParams({}, { replace: true });
                  }}
                  className="cursor-pointer text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
                >
                  Clear search
                </button>
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                {nights} night{nights === 1 ? "" : "s"} · {applied.guests} guest{applied.guests === 1 ? "" : "s"} · prices
                are totals for your stay.
              </p>
              {items.length === 0 ? (
                <p className="mt-6 text-sm text-ink-muted">No stay fits {applied.guests} guests. Try fewer guests.</p>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
                  {items.map((it, i) => (
                    <StayCard key={it.unit.id} item={it} href={hrefFor(it.unit)} index={i} />
                  ))}
                </div>
              )}
            </section>
          ) : items.length === 0 ? (
            <p className="text-sm text-ink-muted">No stay fits {applied.guests} guests. Try fewer guests.</p>
          ) : (
            <StayRow title="Stays worth the drive." items={items} hrefFor={hrefFor} />
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
        <section className="px-4 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-14">
            <div className="lg:pt-2">
              <h2 className="site-display text-2xl leading-tight text-brand-700 sm:text-3xl">
                Loved by guests
                <br className="hidden sm:block" /> who stayed with us.
              </h2>
              <p className="mt-4 max-w-xs text-sm text-ink-muted">Real feedback from memorable Vivienda stays.</p>
              <Link
                to="/#stay"
                className="mt-6 hidden h-10 items-center rounded-full bg-brand-700 px-6 text-sm font-medium text-sand-50 shadow-level-2 hover:bg-brand-700/90 lg:inline-flex"
              >
                Book Now
              </Link>
            </div>
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
              {REVIEWS.map((r) => (
                <div key={r.author} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.625rem)] xl:w-[calc(33.333%-0.84rem)]">
                  <ReviewCard {...r} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
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
