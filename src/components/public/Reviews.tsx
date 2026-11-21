import { useState, type CSSProperties } from "react";
import { format, parseISO } from "date-fns";
import { Quote, Star, ThumbsUp } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { REVIEWS } from "../../lib/site";
import { cn } from "../../lib/utils";
import type { PublishedReview } from "../../lib/guest";
import { REVIEW_SOURCE_LABEL, type ReviewSource } from "../../lib/types";

/**
 * Guest reviews as Malaya shows them (2026-11-21): the reviewers' faces, each
 * platform's own mark and score, and quote cards that drift by on their own.
 * Reviews come from the database (written on the site, or copied in from
 * Facebook, Google or Airbnb with the reviewer's picture). The Facebook
 * recommendations in site.ts fill in for any not yet in the database.
 */

export const REVIEW_AVATAR_BUCKET = "review-avatars";

export function reviewAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:/.test(path)) return path;
  return supabase.storage.from(REVIEW_AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export interface Testimonial {
  id: string;
  author: string;
  /** "August 2026". */
  month: string;
  rating: number | null;
  recommends: boolean | null;
  body: string;
  avatarUrl: string | null;
  source: ReviewSource;
  reply: string;
  /** For sorting: the month, as "2026-08-01". */
  date: string;
}

/** "August 2026" → "2026-08-01". */
const isoMonth = (label: string) => {
  const d = new Date(`1 ${label}`);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const monthOf = (iso: string | null | undefined) => (iso ? format(parseISO(iso.slice(0, 10)), "MMMM yyyy") : "");

/** The database's reviews, then any site.ts recommendation not imported yet. */
export function toTestimonials(published: PublishedReview[]): Testimonial[] {
  // The site's own copy of a Facebook review fills in its face and its full
  // words until the database row has them (Admin → Reviews → Import).
  const known = new Map(REVIEWS.map((r) => [r.author.trim().toLowerCase(), r]));
  const fromDb: Testimonial[] = published.map((r) => {
    const local = (r.source ?? "website") === "facebook" ? known.get(r.guest_name.trim().toLowerCase()) : undefined;
    const fuller = local && local.body.length > r.body.length + 10 ? local.body : r.body;
    return {
      id: r.id,
      author: r.guest_name,
      month: monthOf(r.stayed_on ?? r.created_at),
      rating: r.rating,
      recommends: r.recommends ?? (r.rating == null ? true : null),
      body: fuller,
      avatarUrl: reviewAvatarUrl(r.avatar_path) ?? local?.avatar ?? null,
      source: r.source ?? "website",
      reply: r.host_reply,
      date: (r.stayed_on ?? r.created_at).slice(0, 10),
    };
  });
  const names = new Set(fromDb.map((t) => t.author.trim().toLowerCase()));
  const fallback: Testimonial[] = REVIEWS.filter((r) => !names.has(r.author.trim().toLowerCase())).map((r) => ({
    id: `fb-${r.author}`,
    author: r.author,
    month: r.month,
    rating: null,
    recommends: true,
    body: r.body,
    avatarUrl: r.avatar,
    source: "facebook",
    reply: "",
    date: isoMonth(r.month),
  }));
  // Faces first: a card with a real picture reads as a real person.
  return [...fromDb, ...fallback].sort((a, b) => Number(Boolean(b.avatarUrl)) - Number(Boolean(a.avatarUrl)));
}

/** Each platform's own headline: a star average, or Facebook's recommend share. */
export function platformScores(list: Testimonial[]) {
  const order: ReviewSource[] = ["google", "airbnb", "website", "facebook", "other"];
  return order
    .map((source) => {
      const mine = list.filter((t) => t.source === source);
      const rated = mine.filter((t) => t.rating != null);
      const verdicts = mine.filter((t) => t.rating == null && t.recommends != null);
      if (rated.length && rated.length >= verdicts.length)
        return { source, big: (rated.reduce((s, t) => s + (t.rating ?? 0), 0) / rated.length).toFixed(1), stars: true, count: rated.length };
      if (verdicts.length)
        return {
          source,
          big: `${Math.round((verdicts.filter((t) => t.recommends).length / verdicts.length) * 100)}%`,
          stars: false,
          count: verdicts.length,
        };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

/** The platform's own mark, small. The website's is Vivienda's logo. */
export function SourceLogo({ source, className = "size-5" }: { source: ReviewSource; className?: string }) {
  const label = REVIEW_SOURCE_LABEL[source];
  if (source === "facebook")
    return (
      <svg viewBox="0 0 24 24" className={className} role="img" aria-label={label}>
        <circle cx="12" cy="12" r="12" fill="#0866FF" />
        <path
          fill="#fff"
          d="M13.4 24v-8.6h2.9l.45-3.35H13.4V9.9c0-.97.27-1.63 1.66-1.63h1.77V5.27a23.6 23.6 0 0 0-2.58-.13c-2.56 0-4.3 1.56-4.3 4.42v2.48H7.06v3.35h2.9V24h3.44z"
        />
      </svg>
    );
  if (source === "google")
    return (
      <svg viewBox="0 0 24 24" className={className} role="img" aria-label={label}>
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.47 3.76 1.29 5.38l3.98-3.09z" />
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
      </svg>
    );
  if (source === "airbnb")
    return (
      <svg viewBox="0 0 24 24" className={className} role="img" aria-label={label}>
        <path
          fill="none"
          stroke="#FF385C"
          strokeWidth="2"
          strokeLinejoin="round"
          d="M12 17.6c-1.9-2.4-3.1-4.4-3.1-5.9 0-1.4 1.2-2.3 3.1-2.3s3.1.9 3.1 2.3c0 1.5-1.2 3.5-3.1 5.9zm0 0c1.3 1.7 2.8 3 4.5 3 2.4 0 3.9-2.4 2.9-4.8L16 8.2C14.8 5.4 13.7 3.4 12 3.4S9.2 5.4 8 8.2l-3.4 7.6c-1 2.4.5 4.8 2.9 4.8 1.7 0 3.2-1.3 4.5-3z"
        />
      </svg>
    );
  if (source === "website") return <img src="/images/logo-192.png" alt={label} className={cn("rounded-full", className)} />;
  return null;
}

/** The reviewer's picture, or their initial on a brown tint when there is none or it fails. */
export function ReviewerAvatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 font-display text-sm text-brand-700",
        className,
      )}
    >
      {url && failed !== url ? (
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} className="size-full object-cover" />
      ) : (
        name.trim().slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/** Stars when the review has them; Facebook's thumb and "Recommends" when it doesn't. */
export function Verdict({ rating, recommends, className }: { rating: number | null; recommends: boolean | null; className?: string }) {
  if (rating != null)
    return (
      <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn("size-3.5", n <= rating ? "fill-brand-700 text-brand-700" : "text-sand-300")} />
        ))}
      </span>
    );
  if (recommends == null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-ink-soft", className)}>
      <ThumbsUp className="size-3.5 text-[#0866FF]" aria-hidden />
      {recommends ? "Recommends Vivienda" : "Doesn't recommend"}
    </span>
  );
}

export function TestimonialCard({ t, className }: { t: Testimonial; className?: string }) {
  return (
    <figure className={cn("flex h-full flex-col rounded-2xl border border-sand-200/60 bg-white p-6 shadow-level-2", className)}>
      <div className="flex items-start justify-between gap-3">
        <Quote className="size-6 rotate-180 fill-brand-700 text-brand-700" aria-hidden />
        <SourceLogo source={t.source} className="size-5" />
      </div>
      <Verdict rating={t.rating} recommends={t.recommends} className="mt-3" />
      <blockquote className="mt-4 line-clamp-6 flex-1 text-sm leading-relaxed text-ink-soft" title={t.body.length > 260 ? t.body : undefined}>
        {t.body}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-sand-200/70 pt-5">
        <ReviewerAvatar name={t.author} url={t.avatarUrl} className="size-10" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{t.author}</span>
          <span className="block truncate text-xs text-ink-muted">
            {t.month}
            {t.source !== "website" ? ` · via ${REVIEW_SOURCE_LABEL[t.source]}` : " · stayed with us"}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Left: one line that carries the number, the faces, the platform scores.
 * Right: the cards, drifting left on a loop, paused under the pointer. Too few
 * to fill the strip and it sits still. Drawn on whatever ground the section has;
 * `tone` sets the text for a dark one.
 */
export function TestimonialSection({ testimonials, tone = "light" }: { testimonials: Testimonial[]; tone?: "light" | "dark" }) {
  if (testimonials.length === 0) return null;
  const good = testimonials.filter((t) => (t.rating == null ? t.recommends === true : t.rating >= 4));
  const faces = testimonials.filter((t) => t.avatarUrl).slice(0, 5);
  const shownFaces = faces.length >= 3 ? faces : testimonials.slice(0, 5);
  const scores = platformScores(testimonials);
  const moving = testimonials.length >= 4;
  const dark = tone === "dark";
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-14">
      <div className="lg:pt-4">
        <p className={cn("brand-eyebrow text-[11px]", dark ? "text-sand-50/60" : "text-ink-muted")}>Guest reviews</p>
        <h2 className={cn("site-display mt-3 text-3xl leading-tight sm:text-4xl", dark ? "text-sand-50" : "text-brand-heading")}>
          Loved by {good.length}
          <br /> guests.
        </h2>
        <ul className="mt-6 flex -space-x-3" aria-hidden>
          {shownFaces.map((f) => (
            <li key={f.id}>
              <ReviewerAvatar name={f.author} url={f.avatarUrl} className={cn("size-11 ring-2", dark ? "ring-espresso" : "ring-white")} />
            </li>
          ))}
          {good.length > shownFaces.length && (
            <li
              className={cn(
                "grid size-11 place-items-center rounded-full text-xs font-semibold ring-2",
                dark ? "bg-sand-50 text-espresso ring-espresso" : "bg-brand-700 text-sand-50 ring-white",
              )}
            >
              +{good.length - shownFaces.length}
            </li>
          )}
        </ul>
        {scores.length > 0 && (
          <ul className="mt-6 space-y-2.5">
            {scores.map((p) => (
              <li key={p.source} className="flex items-center gap-2.5 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white shadow-level-1">
                  <SourceLogo source={p.source} className="size-4" />
                </span>
                <span className={cn("font-semibold", dark ? "text-sand-50" : "text-ink")}>{p.big}</span>
                {p.stars ? <Star className="-ml-1 size-3.5 fill-amber-400 text-amber-400" aria-hidden /> : null}
                <span className={dark ? "text-sand-50/65" : "text-ink-muted"}>
                  {p.stars ? "" : "recommend · "}
                  {p.count} on {REVIEW_SOURCE_LABEL[p.source]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={cn(
          "marquee group -my-3 min-w-0 py-3",
          moving
            ? "overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4rem,black_calc(100%-4rem),transparent)]"
            : "overflow-x-auto",
        )}
      >
        <div
          className={cn("flex w-max", moving && "marquee-track group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]")}
          style={{ animationDuration: `${testimonials.length * 8}s` } as CSSProperties}
        >
          {(moving ? [0, 1] : [0]).map((copy) => (
            <ul key={copy} className="flex shrink-0 gap-5 pr-5" aria-hidden={copy === 1 || undefined} inert={copy === 1 || undefined}>
              {testimonials.map((t) => (
                <li key={t.id} className="flex w-[17.5rem] shrink-0 sm:w-[19rem]">
                  <TestimonialCard t={t} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}

type ReviewOrder = "top" | "new" | "old";
type ReviewFilter = "all" | "5" | "4" | "recommends";

/**
 * The listing page's reviews, as Malaya sets them: a heading and the score,
 * two quiet filters, then one row per guest (face, name, month, where it came
 * from, the verdict, the words) with a hairline between, four at first.
 */
export function GuestReviewList({ testimonials }: { testimonials: Testimonial[] }) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [order, setOrder] = useState<ReviewOrder>("top");
  const [all, setAll] = useState(false);
  const scores = platformScores(testimonials);
  const rated = testimonials.filter((t) => t.rating != null);
  const avg = rated.length ? rated.reduce((s, t) => s + (t.rating ?? 0), 0) / rated.length : null;
  const recommendPct = (() => {
    const v = testimonials.filter((t) => t.rating == null && t.recommends != null);
    return v.length ? Math.round((v.filter((t) => t.recommends).length / v.length) * 100) : null;
  })();
  const rank = (t: Testimonial) => (t.avatarUrl ? 2 : 0) + Math.min(t.body.length, 400) / 200 + (t.rating ?? (t.recommends ? 5 : 0));
  const list = testimonials
    .filter((t) =>
      filter === "all" ? true : filter === "recommends" ? t.rating == null && t.recommends : (t.rating ?? 0) >= Number(filter),
    )
    .slice()
    .sort((a, b) => (order === "top" ? rank(b) - rank(a) : order === "new" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  const shown = all ? list : list.slice(0, 4);
  const pill =
    "h-9 cursor-pointer appearance-none rounded-full border-0 bg-transparent py-0 pr-8 pl-4 text-sm font-medium text-ink focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="site-display text-brand-heading text-2xl leading-tight">Guest reviews</h2>
          <p className="mt-1 text-sm text-ink-muted">What previous guests said about their stay.</p>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          {avg != null && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 fill-brand-700 text-brand-700" /> <b className="text-ink">{avg.toFixed(2)}</b> · {rated.length} rated
            </span>
          )}
          {recommendPct != null && (
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="size-4 text-brand-700" /> <b className="text-ink">{recommendPct}% recommend</b> · {testimonials.length} reviews
            </span>
          )}
        </p>
      </div>

      <div className="mt-5 inline-flex divide-x divide-sand-300 rounded-full border border-sand-300 bg-white">
        <select value={filter} onChange={(e) => setFilter(e.target.value as ReviewFilter)} aria-label="Filter reviews" className={pill}>
          <option value="all">All ratings</option>
          {rated.length > 0 && <option value="5">5 stars</option>}
          {rated.length > 0 && <option value="4">4 stars & up</option>}
          {scores.some((p) => !p.stars) && <option value="recommends">Recommends</option>}
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value as ReviewOrder)} aria-label="Sort reviews" className={pill}>
          <option value="top">Top reviews</option>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No reviews match that.</p>
      ) : (
        <ul className="mt-4 divide-y divide-sand-200">
          {shown.map((t) => (
            <li key={t.id} className="py-5">
              <div className="flex items-start gap-3">
                <ReviewerAvatar name={t.author} url={t.avatarUrl} className="size-11" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-semibold text-ink">{t.author}</span>
                    <span className="text-xs text-ink-muted">{t.month}</span>
                    {t.source !== "website" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sand-300 px-2 py-0.5 text-[11px] text-ink-soft">
                        <SourceLogo source={t.source} className="size-3.5" /> {REVIEW_SOURCE_LABEL[t.source]} review
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Stayed with us</span>
                    )}
                  </p>
                  <Verdict rating={t.rating} recommends={t.recommends} className="mt-1" />
                </div>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{t.body}</p>
              {t.reply && (
                <p className="mt-3 rounded-xl bg-linen/70 px-4 py-3 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">Response from Vivienda: </span>
                  {t.reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {list.length > 4 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 cursor-pointer text-sm font-semibold text-ink underline-offset-4 hover:underline"
        >
          {all ? "Show fewer" : `Show all ${list.length} reviews`}
        </button>
      )}
    </div>
  );
}
