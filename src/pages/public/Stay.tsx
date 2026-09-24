import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Grid3X3,
  BedDouble,
  Wifi,
  Lock,
  MapPin,
  Users,
  Waves,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { nightlyRate, useRateOverrides, useSettings, useUnavailableNights, useUnits } from "../../lib/queries";
import { compactMoney, isoDate, money, plural, prettyDate, prettyTime } from "../../lib/format";
import { DEFAULT_AMENITIES, LOCATION_LABEL, REVIEWS, SITE, SLEEPING } from "../../lib/site";
import { cn } from "../../lib/utils";
import type { Quote } from "../../lib/types";
import { RangeCalendar, type DateRange } from "../../components/RangeCalendar";
import { Spinner } from "../../components/ui";
import { Stepper } from "../../components/public/SearchPill";
import { ReviewCard, unitPhotos } from "../../components/public/StayBits";

export default function Stay() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: settings } = useSettings();
  const { data: units, isLoading } = useUnits();
  const unit = units?.find((u) => u.slug === slug && u.is_active);

  const today = isoDate(new Date());
  const horizon = isoDate(addDays(new Date(), 400));
  const { data: unavailable } = useUnavailableNights(unit?.id, today, horizon);
  const { data: overrides } = useRateOverrides(unit?.id);

  const range: DateRange = { checkIn: params.get("in"), checkOut: params.get("out") };
  const guests = Math.min(Number(params.get("guests")) || 2, unit?.max_guests ?? 99);
  const [showAll, setShowAll] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  function update(next: Partial<{ in: string | null; out: string | null; guests: number }>) {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") q.delete(k);
      else q.set(k, String(v));
    }
    setParams(q, { replace: true });
  }
  const setRange = (r: DateRange) => update({ in: r.checkIn, out: r.checkOut });

  // Dates from a search that are no longer free are dropped rather than shown as bookable.
  useEffect(() => {
    if (!unavailable || !range.checkIn || !range.checkOut) return;
    for (let d = range.checkIn; d < range.checkOut; d = isoDate(addDays(new Date(`${d}T00:00:00`), 1))) {
      if (unavailable.has(d)) return update({ in: null, out: null });
    }
  }, [unavailable]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ["quote", unit?.id, range.checkIn, range.checkOut, guests],
    enabled: Boolean(unit && range.checkIn && range.checkOut),
    queryFn: async (): Promise<Quote> => {
      const { data, error } = await supabase.rpc("quote_stay", {
        p_unit: unit!.id,
        p_check_in: range.checkIn,
        p_check_out: range.checkOut,
        p_guests: guests,
      });
      if (error) throw error;
      const row = (data as Quote[])[0]!;
      return {
        nights: Number(row.nights),
        room_total: Number(row.room_total),
        extra_guest_total: Number(row.extra_guest_total),
        total: Number(row.total),
      };
    },
  });

  const photos = useMemo(() => (unit ? unitPhotos(unit) : []), [unit]);

  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  if (!unit) return <Navigate to="/#stay" replace />;

  const amenities = unit.amenities.length ? unit.amenities : DEFAULT_AMENITIES;
  const about = unit.description || settings?.about || SITE.about;
  const ready = Boolean(range.checkIn && range.checkOut);

  function reserve() {
    if (!ready) {
      setDatesOpen(true);
      return;
    }
    navigate(`/book?unit=${unit!.slug}&in=${range.checkIn}&out=${range.checkOut}&guests=${guests}`);
  }

  const rules: [ReactNode, string][] = [
    [<Clock key="i" />, `Check-in after ${prettyTime(settings?.check_in_time ?? "14:00")}`],
    [<Clock key="o" />, `Check-out before ${prettyTime(settings?.check_out_time ?? "12:00")}`],
    [<Users key="g" />, `Maximum ${unit.max_guests} guests`],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 pb-28 sm:px-8 lg:pb-16">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link to="/#stay" className="hover:text-brand-700">
          Stays
        </Link>
        <span className="mx-1.5">/</span>
        <span>Alitagtag</span>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-ink">{unit.name}</span>
      </nav>

      {/* Photo mosaic */}
      <div className="relative grid h-[260px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-[420px]">
        {photos.slice(0, 5).map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setShowAll(true)}
            className={cn(
              "cursor-pointer overflow-hidden bg-sand-100",
              i === 0 ? "col-span-4 row-span-2 sm:col-span-2" : "hidden sm:block",
            )}
          >
            <img src={src} alt="" className="size-full object-cover transition-transform duration-500 hover:scale-105" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="absolute right-4 bottom-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-ink shadow-level-2 hover:bg-white"
        >
          <Grid3X3 className="size-3.5" /> Show all {photos.length} photos
        </button>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold text-brand-700 sm:text-4xl">{unit.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
            <MapPin className="size-4 text-brand-700" /> {LOCATION_LABEL}
            <Sep /> Sleeps {unit.max_guests}
            <Sep /> {money(unit.base_rate, true)} weekdays
            {unit.weekend_rate != null && unit.weekend_rate !== unit.base_rate && (
              <>
                <Sep /> {money(unit.weekend_rate, true)} Fri–Sat
              </>
            )}
          </p>

          <div className="mt-6 grid gap-5 border-y border-sand-200/80 py-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-sand-200/80">
            <Highlight icon={<Waves />} title="Private pool" text="Adult and kids pool, exclusive for your group." />
            <Highlight icon={<BadgeCheck />} title="For family or tropa" text="Karaoke, billiards, bonfire and BBQ included." />
            <Highlight icon={<Wifi />} title="Stay connected" text="PLDT WiFi, smart TV, free Netflix & YouTube." />
          </div>

          <Block title="About this stay">
            <p className={cn("leading-relaxed whitespace-pre-line text-ink-soft", !aboutOpen && "line-clamp-4")}>{about}</p>
            {about.length > 280 && (
              <button
                type="button"
                onClick={() => setAboutOpen((v) => !v)}
                className="mt-2 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-ink underline underline-offset-4"
              >
                Show {aboutOpen ? "less" : "more"} <ChevronDown className={cn("size-4", aboutOpen && "rotate-180")} />
              </button>
            )}
          </Block>

          <Block title="Sleeping arrangements">
            <div className="grid gap-3 sm:grid-cols-2">
              {SLEEPING.map((r) => (
                <div key={r.room} className="rounded-2xl border border-sand-200/80 p-5">
                  <BedDouble className="size-6 text-brand-700" />
                  <p className="mt-3 font-semibold text-ink">{r.room}</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-ink-muted">
                    {r.beds.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Block>

          <Block title="Amenities">
            <ul className="grid gap-x-8 gap-y-3 text-sm text-ink sm:grid-cols-2">
              {amenities.map((a) => (
                <li key={a} className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 fill-brand-700 text-white" /> {a}
                </li>
              ))}
            </ul>
          </Block>

          <Block
            title="Availability"
            aside={
              <span className="hidden items-center gap-4 text-xs text-ink-muted sm:flex">
                <Legend className="bg-brand-700" /> Selected
                <Legend className="bg-sand-300" /> Booked
                <Legend className="border border-sand-300 bg-white" /> Available
              </span>
            }
          >
            <RangeCalendar
              value={range}
              onChange={setRange}
              unavailable={unavailable ?? new Set()}
              dayNote={(iso) => compactMoney(nightlyRate(unit, iso, overrides))}
            />
            <p className="mt-3 text-xs text-ink-muted">Crossed-out nights are taken. Prices shown are per night.</p>
          </Block>

          {REVIEWS.length > 0 && (
            <Block title="Reviews">
              <div className="grid gap-4 sm:grid-cols-2">
                {REVIEWS.slice(0, 4).map((r) => (
                  <ReviewCard key={r.author} {...r} />
                ))}
              </div>
            </Block>
          )}

          <Block title="Location">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
              <iframe
                title="Map to Vivienda"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(settings?.address || SITE.address)}&z=14&output=embed`}
                loading="lazy"
                className="h-56 w-full rounded-2xl border border-sand-200/80"
              />
              <div className="flex flex-col justify-between gap-4 text-sm">
                <div>
                  <p className="font-medium text-ink">{settings?.address || SITE.address}</p>
                  <p className="mt-2 text-ink-muted">
                    Exact directions are sent with your confirmation. Call {settings?.phone || SITE.phone} if you get lost.
                  </p>
                </div>
                <a
                  href={settings?.map_url || SITE.mapUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-sand-300 px-4 font-medium text-ink hover:bg-sand-100"
                >
                  View on map
                </a>
              </div>
            </div>
          </Block>

          <Block title="House rules">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="eyebrow mb-3">Check-in / check-out</p>
                <ul className="space-y-2.5 text-sm text-ink">
                  {rules.map(([icon, text]) => (
                    <li key={text} className="flex items-center gap-2.5 [&_svg]:size-4 [&_svg]:text-brand-700">
                      {icon} {text}
                    </li>
                  ))}
                </ul>
              </div>
              {settings?.house_rules && (
                <div>
                  <p className="eyebrow mb-3">During your stay</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">{settings.house_rules}</p>
                </div>
              )}
              {settings?.cancellation_policy && (
                <div className="sm:col-span-2">
                  <p className="eyebrow mb-3">Cancellations</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">{settings.cancellation_policy}</p>
                </div>
              )}
            </div>
          </Block>
        </div>

        {/* Reserve card */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-sand-200/70 bg-white p-6 shadow-level-3">
            <p className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-ink">{money(unit.base_rate, true)}</span>
              <span className="text-sm text-ink-muted">/ night</span>
            </p>

            <div className="relative mt-5">
              <button
                type="button"
                onClick={() => setDatesOpen((v) => !v)}
                className="grid w-full cursor-pointer grid-cols-2 overflow-hidden rounded-xl border border-sand-300 text-left"
              >
                <span className="border-r border-sand-300 px-3 py-2.5">
                  <span className="block text-[10px] font-semibold tracking-wide text-ink uppercase">Check in</span>
                  <span className={cn("block text-sm", range.checkIn ? "text-ink" : "text-ink-muted")}>
                    {range.checkIn ? prettyDate(range.checkIn, "MMM d") : "Add date"}
                  </span>
                </span>
                <span className="px-3 py-2.5">
                  <span className="block text-[10px] font-semibold tracking-wide text-ink uppercase">Check out</span>
                  <span className={cn("block text-sm", range.checkOut ? "text-ink" : "text-ink-muted")}>
                    {range.checkOut ? prettyDate(range.checkOut, "MMM d") : "Add date"}
                  </span>
                </span>
              </button>
              {datesOpen && (
                <DatesPopover
                  onClose={() => setDatesOpen(false)}
                  value={range}
                  onChange={(r) => {
                    setRange(r);
                    if (r.checkIn && r.checkOut) setDatesOpen(false);
                  }}
                  unavailable={unavailable ?? new Set()}
                  dayNote={(iso) => compactMoney(nightlyRate(unit, iso, overrides))}
                />
              )}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-sand-300 px-3 py-2.5">
              <span>
                <span className="block text-[10px] font-semibold tracking-wide text-ink uppercase">Guests</span>
                <span className="block text-sm text-ink">{plural(guests, "guest")}</span>
              </span>
              <Stepper value={guests} min={1} max={unit.max_guests} onChange={(g) => update({ guests: g })} />
            </div>

            <button
              type="button"
              onClick={reserve}
              className="mt-5 h-12 w-full cursor-pointer rounded-xl bg-brand-700 text-base font-semibold text-sand-50 shadow-level-2 transition-colors hover:bg-brand-700/90"
            >
              {ready ? "Reserve" : "Check availability"}
            </button>

            {quote && ready ? (
              <dl className={cn("mt-5 space-y-2.5 text-sm", quoting && "opacity-60")}>
                <PriceRow
                  label={`${money(Math.round(quote.room_total / quote.nights), true)} × ${plural(quote.nights, "night")}`}
                  value={money(quote.room_total, true)}
                />
                {quote.extra_guest_total > 0 && <PriceRow label="Extra guests" value={money(quote.extra_guest_total, true)} />}
                <div className="flex justify-between border-t border-sand-200 pt-3 text-base font-semibold text-ink">
                  <dt>Total</dt>
                  <dd>{money(quote.total, true)}</dd>
                </div>
                <p className="pt-1 text-center text-xs text-ink-muted">You won't be charged yet</p>
              </dl>
            ) : (
              <p className="mt-4 text-center text-xs text-ink-muted">Pick your dates to see the total.</p>
            )}
            <p className="mt-5 flex items-center justify-center gap-2 border-t border-sand-200 pt-4 text-sm text-ink-soft">
              <Lock className="size-4 text-brand-700" /> Clear pricing. Secure booking.
            </p>
          </div>
        </aside>
      </div>

      {/* Phone reserve bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-sand-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0">
          {quote && ready ? (
            <>
              <p className="text-base font-semibold text-ink">{money(quote.total, true)}</p>
              <p className="truncate text-xs text-ink-muted underline">
                {prettyDate(range.checkIn, "MMM d")} – {prettyDate(range.checkOut, "MMM d")}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink">
              <span className="font-semibold">{money(unit.base_rate, true)}</span>
              <span className="text-ink-muted"> / night</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => (ready ? reserve() : document.getElementById("availability")?.scrollIntoView({ behavior: "smooth" }))}
          className="h-11 shrink-0 cursor-pointer rounded-xl bg-brand-700 px-6 text-sm font-semibold text-sand-50"
        >
          {ready ? "Reserve" : "Pick dates"}
        </button>
      </div>

      {showAll && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <div className="sticky top-0 flex items-center justify-between border-b border-sand-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
            <p className="font-medium text-ink">{unit.name}</p>
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-sand-100"
              aria-label="Close photos"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="mx-auto grid max-w-4xl gap-3 px-4 py-6 sm:grid-cols-2">
            {photos.map((src, i) => (
              <img key={src} src={src} alt="" className={cn("w-full rounded-xl object-cover", i % 3 === 0 && "sm:col-span-2")} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DatesPopover({
  onClose,
  ...cal
}: {
  onClose: () => void;
  value: DateRange;
  onChange: (r: DateRange) => void;
  unavailable: Set<string>;
  dayNote: (iso: string) => string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div className="absolute top-full right-0 z-40 mt-2 w-[640px] rounded-2xl border border-sand-200/70 bg-white p-5 shadow-level-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <CalendarClock className="size-4 text-brand-700" /> Select dates
          </p>
          {cal.value.checkIn && (
            <button
              type="button"
              onClick={() => cal.onChange({ checkIn: null, checkOut: null })}
              className="cursor-pointer text-xs font-medium text-ink-muted underline underline-offset-4"
            >
              Clear dates
            </button>
          )}
        </div>
        <RangeCalendar {...cal} />
      </div>
    </>
  );
}

function Sep() {
  return <span className="text-ink-muted/60">•</span>;
}

function Legend({ className }: { className: string }) {
  return <span className={cn("inline-block size-2.5 rounded-sm", className)} />;
}

function Highlight({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 sm:px-5 sm:first:pl-0 sm:last:pr-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-700/10 text-brand-700 [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{text}</p>
      </div>
    </div>
  );
}

function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={title.toLowerCase()} className="scroll-mt-24 border-b border-sand-200/80 py-8 last:border-b-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-brand-700">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-ink-soft">
      <dt>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
