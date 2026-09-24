import { Quote, ThumbsUp } from "lucide-react";
import { photoUrl } from "../../lib/supabase";
import { GALLERY } from "../../lib/site";
import type { Unit } from "../../lib/types";

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
      <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink-muted">{body}</blockquote>
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
