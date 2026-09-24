import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Baby,
  BedDouble,
  Car,
  Clock,
  Flower2,
  MapPin,
  Search,
  Sparkles,
  Sun,
  Users,
  Waves,
} from "lucide-react";
import { photoUrl } from "../../lib/supabase";
import { useSettings, useUnits } from "../../lib/queries";
import { isoDate, money, prettyTime } from "../../lib/format";
import { PHOTOS, PROMO, SITE } from "../../lib/site";
import { EmptyState, Spinner } from "../../components/ui";
import type { Unit } from "../../lib/types";

const HIGHLIGHTS = [
  { icon: Waves, title: "Private pool", text: "The whole pool is yours, with a shallow kiddie pool beside it." },
  { icon: Sun, title: "Glass A-frame lounge", text: "Floor-to-ceiling windows and loungers facing the water." },
  { icon: Flower2, title: "Garden picnic area", text: "Shaded tables and stepping-stone paths for long afternoons." },
  { icon: Baby, title: "Kids' play corner", text: "Swing and slide on the lawn, in sight of the tables." },
  { icon: BedDouble, title: "Villa with balcony", text: "Rooms upstairs look out over the garden and the fields." },
  { icon: Car, title: "Private parking", text: "Gated driveway with room for your group's cars." },
];

const GALLERY = [PHOTOS.poolAframe, PHOTOS.garden, PHOTOS.trellis, PHOTOS.lounge, PHOTOS.front, PHOTOS.driveway];

export default function Home() {
  const { data: s } = useSettings();
  const { data: units, isLoading } = useUnits();
  const { hash } = useLocation();
  const active = (units ?? []).filter((u) => u.is_active);
  const promoOn = PROMO && PROMO.until >= isoDate(new Date());

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash, isLoading]);

  return (
    <>
      {/* Hero: centred display serif on white, as in the Malaya landing page. */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 pt-12 text-center sm:px-8 sm:pt-16">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-brand-700 sm:text-xs">
            ALITAGTAG <Dot /> BATANGAS <Dot /> PRIVATE POOL
          </p>
          <h1 className="site-display mt-5 text-[2.6rem] leading-[1.05] text-brand-700 sm:text-6xl lg:text-7xl">
            Your private
            <br />
            tropical haven.
          </h1>
          <div className="mx-auto mt-6 h-px w-16 bg-brand-700/40" />
          <p className="mx-auto mt-6 max-w-xl text-base text-ink sm:text-lg">
            Relax, unwind, and enjoy exclusive access to our private pool.
          </p>
        </div>

        <div className="relative mx-auto mt-10 max-w-6xl px-4 sm:px-8">
          <InfoPill checkIn={prettyTime(s?.check_in_time ?? "14:00")} checkOut={prettyTime(s?.check_out_time ?? "12:00")} />
          <div className="-mt-10 overflow-hidden rounded-3xl shadow-level-3 sm:-mt-12">
            <img
              src={PHOTOS.aerial.src}
              alt={PHOTOS.aerial.alt}
              className="aspect-[4/3] w-full object-cover sm:aspect-[16/8]"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      {promoOn && PROMO && (
        <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-brand-700 text-sand-50 shadow-level-3">
            <img src={PHOTOS.poolAframe.src} alt="" className="absolute inset-0 size-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-linear-to-r from-brand-800 via-brand-700/90 to-brand-700/40" />
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
                <p className="mt-2 text-xs text-sand-50/75">Weekdays · until {formatUntil(PROMO.until)}</p>
                <Link
                  to="/book"
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand-700 shadow-level-2 transition-colors hover:bg-sand-100"
                >
                  Book the promo <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* About */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-8 md:grid-cols-2 md:gap-14">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <img
            src={PHOTOS.lounge.src}
            alt={PHOTOS.lounge.alt}
            loading="lazy"
            className="aspect-[3/4] w-full rounded-2xl object-cover shadow-level-2"
          />
          <img
            src={PHOTOS.trellis.src}
            alt={PHOTOS.trellis.alt}
            loading="lazy"
            className="mt-10 aspect-[3/4] w-full rounded-2xl object-cover shadow-level-2"
          />
        </div>
        <div>
          <p className="eyebrow text-brand-700">About Vivienda</p>
          <h2 className="site-display mt-3 text-3xl leading-tight text-brand-700 sm:text-4xl">
            Your personal
            <br />
            oasis awaits.
          </h2>
          <p className="mt-5 leading-relaxed text-ink-soft">{s?.about || SITE.about}</p>
          <ul className="mt-6 space-y-2.5 text-sm text-ink">
            <li className="flex items-center gap-2.5">
              <MapPin className="size-4 text-brand-700" /> {s?.address || SITE.address}
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="size-4 text-brand-700" /> Check-in from {prettyTime(s?.check_in_time ?? "14:00")} ·
              Check-out by {prettyTime(s?.check_out_time ?? "12:00")}
            </li>
          </ul>
        </div>
      </section>

      {/* Highlights */}
      <section className="bg-sand-100/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <SectionTitle title="Made for slow days." sub="Everything inside the gate is for your group alone." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="lift rounded-2xl border border-sand-200/80 bg-white p-6 shadow-level-2">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-700/10 text-brand-700">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-medium text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section id="stay" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-8">
        <SectionTitle
          title="Stays worth the drive."
          sub="Tap a stay to see open dates and an instant quote. Rates are per night."
        />
        <div className="mt-10">
          {isLoading ? (
            <Spinner />
          ) : active.length === 0 ? (
            <EmptyState icon={<BedDouble />} title="Rates are coming soon">
              We're setting things up. Message us on Facebook or call {s?.phone || SITE.phone} to book in the meantime.
            </EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {active.map((u, i) => (
                <UnitCard key={u.id} unit={u} fallback={GALLERY[i % GALLERY.length]!.src} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="scroll-mt-20 bg-sand-100/70">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
          <SectionTitle title="A look around." sub="From the gate to the garden, sunrise to sunset." />
          <div className="mt-10 grid auto-rows-[160px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:gap-4 lg:grid-cols-4">
            {GALLERY.map((p, i) => (
              <figure
                key={p.src}
                className={
                  "overflow-hidden rounded-2xl shadow-level-2 " +
                  (i === 0 ? "col-span-2 row-span-2" : i === 3 ? "row-span-2" : "")
                }
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Policies */}
      {s && (s.house_rules || s.cancellation_policy) && (
        <section id="policies" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-8">
          <SectionTitle title="Good to know." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <PolicyCard icon={<Clock />} title="Check-in & check-out">
              Check-in from {prettyTime(s.check_in_time)}
              <br />
              Check-out by {prettyTime(s.check_out_time)}
            </PolicyCard>
            {s.house_rules && <PolicyCard title="House rules">{s.house_rules}</PolicyCard>}
            {s.cancellation_policy && <PolicyCard title="Cancellations">{s.cancellation_policy}</PolicyCard>}
          </div>
        </section>
      )}

      {/* Closing call to action */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl shadow-level-3">
          <img src={PHOTOS.gate.src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-espresso/60" />
          <div className="relative px-6 py-16 text-center text-sand-50 sm:py-20">
            <h2 className="site-display text-3xl leading-tight sm:text-5xl">The perfect escape.</h2>
            <p className="mx-auto mt-4 max-w-md text-sand-50/85">
              Pick your dates, get an instant quote, and we'll confirm within the day.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/book"
                className="inline-flex h-11 items-center rounded-full bg-white px-7 text-sm font-semibold text-brand-700 shadow-level-2 hover:bg-sand-100"
              >
                Book Now
              </Link>
              <a
                href={SITE.phoneHref}
                className="inline-flex h-11 items-center rounded-full border border-sand-50/50 px-7 text-sm font-medium text-sand-50 hover:bg-sand-50/10"
              >
                Call {s?.phone || SITE.phone}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Dot() {
  return <span className="mx-2 text-brand-700/60 sm:mx-3">•</span>;
}

function formatUntil(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** The Malaya search bar, turned into what Vivienda needs: facts plus one button. */
function InfoPill({ checkIn, checkOut }: { checkIn: string; checkOut: string }) {
  return (
    <div className="relative z-10 mx-auto grid max-w-4xl grid-cols-2 gap-1 rounded-3xl border border-sand-200/80 bg-white p-3 shadow-level-4 sm:flex sm:items-center sm:rounded-full sm:p-2 sm:pl-4">
      <PillItem icon={<MapPin />} label="Location" value="Alitagtag" />
      <PillDivider />
      <PillItem icon={<Clock />} label="Check-in" value={`From ${checkIn}`} />
      <PillDivider />
      <PillItem icon={<Clock />} label="Check-out" value={`By ${checkOut}`} />
      <PillDivider />
      <PillItem icon={<Users />} label="Exclusive" value="Whole place" />
      <Link
        to="/book"
        className="col-span-2 mt-2 inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-700 px-6 text-sm font-medium text-sand-50 shadow-level-2 transition-colors hover:bg-brand-700/90 sm:mt-0 sm:ml-2"
      >
        <Search className="size-4" /> Check availability
      </Link>
    </div>
  );
}

function PillItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left sm:gap-3 sm:px-3">
      <span className="text-ink-soft [&_svg]:size-5">{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[11px] font-semibold tracking-wide text-ink uppercase">{label}</span>
        <span className="block truncate text-sm text-ink-muted">{value}</span>
      </span>
    </div>
  );
}

function PillDivider() {
  return <span className="hidden h-9 w-px bg-sand-200 sm:block" />;
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="site-display text-3xl leading-tight text-brand-700 sm:text-4xl">{title}</h2>
      {sub && <p className="mt-2 max-w-lg text-ink-soft">{sub}</p>}
    </div>
  );
}

function PolicyCard({ icon, title, children }: { icon?: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-sand-200/80 bg-white p-6 shadow-level-2">
      <h3 className="flex items-center gap-2 text-lg font-medium text-ink">
        {icon && <span className="text-brand-700 [&_svg]:size-4">{icon}</span>}
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink-soft">{children}</p>
    </div>
  );
}

/** Villa card, after Malaya's: photo with a chip, eyebrow, name, facts, price. */
function UnitCard({ unit, fallback }: { unit: Unit; fallback: string }) {
  const photo = unit.photos[0] ? photoUrl(unit.photos[0]) : fallback;
  return (
    <Link
      to={`/book?unit=${unit.slug}`}
      className="group lift flex flex-col overflow-hidden rounded-2xl border border-sand-200/70 bg-white shadow-level-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
        <img
          src={photo}
          alt={unit.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-level-1">
          Sleeps {unit.max_guests}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-brand-700 uppercase">Alitagtag, Batangas</p>
        <h3 className="mt-1.5 text-lg font-medium text-ink">{unit.name}</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Up to {unit.max_guests} guests
          {unit.amenities.length > 0 && ` · ${unit.amenities.slice(0, 2).join(" · ")}`}
        </p>
        <p className="mt-auto pt-4 text-sm text-ink-muted">
          From <span className="text-lg font-semibold text-ink">{money(unit.base_rate, true)}</span> /night
        </p>
      </div>
    </Link>
  );
}
