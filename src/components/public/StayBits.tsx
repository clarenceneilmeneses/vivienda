import { Quote, Star, ThumbsUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "../../lib/utils";
import type { PublishedReview } from "../../lib/guest";
import { photoUrl } from "../../lib/supabase";
import { GALLERY } from "../../lib/site";
import { REVIEW_SOURCE_LABEL, type ReviewSource, type Unit } from "../../lib/types";

const SOURCE_STYLE: Record<ReviewSource, string> = {
  website: "bg-emerald-50 text-emerald-800",
  airbnb: "bg-[#ff385c]/10 text-[#d70466]",
  google: "bg-[#4285f4]/10 text-[#1a56c4]",
  facebook: "bg-[#1877f2]/10 text-[#1259b8]",
  other: "bg-sand-100 text-ink-soft",
};

/** The stay's own photos first, then the rest of the property's, so a gallery is never short. */
export function unitPhotos(unit: Unit): string[] {
  const own = unit.photos.map(photoUrl);
  return [...own, ...GALLERY.map((p) => p.src).filter((p) => !own.includes(p))];
}

/** A Facebook recommendation, set like Malaya's testimonial card. */
export function ReviewCard({ author, month, body }: { author: string; month: string; body: string }) {
  return (
    <figure className="flex h-full flex-col rounded-xl border border-sand-200/60 bg-white p-6 shadow-level-1">
      <div className="flex items-center justify-between gap-3">
        <Quote className="size-6 rotate-180 fill-brand-700 text-brand-700" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-700/10 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
          <ThumbsUp className="size-3" /> Recommends
        </span>
      </div>
      <blockquote className="mt-4 line-clamp-7 flex-1 text-sm leading-relaxed text-ink-muted" title={body}>
        {body}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-sand-200/60 pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700 font-display text-xs font-semibold text-sand-50">
          {author.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{author}</span>
          <span className="block truncate text-xs text-ink-muted">{month} · via Facebook</span>
        </span>
      </figcaption>
    </figure>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= rating ? "fill-brand-700 text-brand-700" : "text-sand-300")} />
      ))}
    </span>
  );
}

/**
 * A published review: one a guest left on the site after their stay, or one
 * the owner brought over from Airbnb, Google or Facebook, marked with where.
 */
export function GuestReviewCard({ review }: { review: PublishedReview }) {
  const source = review.source ?? "website";
  return (
    <figure className="flex h-full flex-col rounded-xl border border-sand-200/60 bg-white p-6 shadow-level-1">
      <div className="flex items-center justify-between gap-3">
        <Stars rating={review.rating} />
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            SOURCE_STYLE[source],
          )}
        >
          {source === "website" ? "Verified stay" : `via ${REVIEW_SOURCE_LABEL[source]}`}
        </span>
      </div>
      <blockquote className="mt-4 line-clamp-7 flex-1 text-sm leading-relaxed text-ink-muted" title={review.body}>
        {review.body}
      </blockquote>
      {review.host_reply && (
        <p className="mt-3 line-clamp-3 rounded-lg bg-sand-100 px-3 py-2 text-xs text-ink-soft">
          <span className="font-semibold text-ink">Response from Vivienda: </span>
          {review.host_reply}
        </p>
      )}
      <figcaption className="mt-6 flex items-center gap-3 border-t border-sand-200/60 pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700 font-display text-xs font-semibold text-sand-50">
          {review.guest_name.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{review.guest_name}</span>
          <span className="block truncate text-xs text-ink-muted">
            {review.stayed_on ? `Stayed ${format(parseISO(review.stayed_on), "MMMM yyyy")}` : REVIEW_SOURCE_LABEL[source]}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

export function averageRating(reviews: PublishedReview[]) {
  if (!reviews.length) return null;
  return Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 100) / 100;
}
