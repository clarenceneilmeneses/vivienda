import type { ReviewSource } from "./types";

/**
 * Reads guest reviews out of a browser HAR recording, in the browser, so the
 * owner imports them from Admin → Reviews instead of running a script. The
 * readers are Malaya's (scripts/import-*-reviews.mjs, 2026-10), ported:
 *
 *   Facebook  the page's Reviews tab: GraphQL "Story" objects. Recommends or
 *             doesn't, no stars.
 *   Google    google.com/travel → the place → Reviews: batchexecute ocp93e.
 *             Stars; the month worked out from "4 months ago".
 *   Airbnb    the host profile's "Show all reviews" (or a listing's reviews):
 *             StayListingReview objects. Stars.
 *
 * The reviewer's picture is taken from the recording itself when the browser
 * loaded it (a HAR saved with content carries the image), since Facebook's
 * links expire and the platforms refuse cross-site downloads.
 */

export interface ReviewDraft {
  key: string;
  source: ReviewSource;
  name: string;
  body: string;
  rating: number | null;
  recommends: boolean | null;
  /** The month, pinned to the 1st: "2026-08-01". */
  month: string;
  avatarUrl: string | null;
  /** The picture's bytes, when the recording has them. */
  avatar: Blob | null;
}

export interface HarResult {
  source: ReviewSource | null;
  drafts: ReviewDraft[];
  /** How many the platform says there are, when it says. */
  total: number | null;
  skipped: string[];
}

interface HarEntry {
  startedDateTime?: string;
  request: { url: string };
  response?: { content?: { text?: string; encoding?: string; mimeType?: string } };
}

function textOf(e: HarEntry): string {
  const c = e.response?.content;
  if (!c?.text) return "";
  if (c.encoding !== "base64") return c.text;
  try {
    const bin = atob(c.text);
    return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  } catch {
    return "";
  }
}

function blobOf(e: HarEntry): Blob | null {
  const c = e.response?.content;
  if (!c?.text || !(c.mimeType ?? "").startsWith("image/")) return null;
  try {
    const bin = c.encoding === "base64" ? atob(c.text) : c.text;
    return new Blob([Uint8Array.from(bin, (ch) => ch.charCodeAt(0))], { type: c.mimeType });
  } catch {
    return null;
  }
}

const monthOfDate = (d: Date) => `${d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7)}-01`;
const clean = (s: string) => s.replace(/\s+\n/g, "\n").trim();

export function parseHar(raw: string, ownName = "vivienda"): HarResult {
  let entries: HarEntry[];
  try {
    entries = (JSON.parse(raw) as { log: { entries: HarEntry[] } }).log.entries;
  } catch {
    throw new Error("That isn't a HAR file. In the browser's Network tab, use the download arrow (Export HAR).");
  }
  // Every image the browser loaded, by its address, to re-host the faces.
  const images = new Map<string, Blob>();
  for (const e of entries) {
    const b = blobOf(e);
    if (b) images.set(e.request.url, b);
  }
  const pic = (url: string | null | undefined) => (url ? (images.get(url) ?? null) : null);

  const urls = entries.map((e) => e.request.url);
  if (urls.some((u) => /facebook\.com/.test(u))) return facebook(entries, pic, ownName);
  if (urls.some((u) => /batchexecute\?rpcids=ocp93e/.test(u))) return google(entries, pic, ownName);
  if (urls.some((u) => /airbnb\./.test(u))) return airbnb(entries, pic);
  return { source: null, drafts: [], total: null, skipped: [] };
}

type Pic = (url: string | null | undefined) => Blob | null;

// ───────────────────────── Facebook ─────────────────────────

function facebook(entries: HarEntry[], pic: Pic, ownName: string): HarResult {
  const docs: unknown[] = [];
  let pageText = "";
  for (const e of entries) {
    if (!/facebook\.com/.test(e.request.url)) continue;
    const text = textOf(e);
    if (!text) continue;
    pageText += text;
    if (/\/api\/graphql/.test(e.request.url)) {
      for (const line of text.split("\n")) {
        try {
          docs.push(JSON.parse(line));
        } catch {
          /* not JSON */
        }
      }
    } else if (/text\/html/.test(e.response?.content?.mimeType ?? "")) {
      for (const m of text.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) {
        try {
          docs.push(JSON.parse(m[1]));
        } catch {
          /* not JSON */
        }
      }
    }
  }
  if (/browser isn.t supported/i.test(pageText) && docs.length === 0)
    throw new Error("Facebook served “This browser isn't supported”. Record it again in desktop mode, not phone mode.");

  type Story = { __typename?: string; post_id?: string; creation_time?: number; comet_sections?: Record<string, unknown> };
  const stories = new Map<string, Story>();
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const s = o as Story;
    if (s.__typename === "Story" && s.comet_sections && s.post_id) {
      if (!stories.has(s.post_id)) stories.set(s.post_id, s);
      return;
    }
    for (const v of Object.values(o)) walk(v);
  };
  docs.forEach(walk);

  const said = pageText.match(/\\?u0025 recommend \((\d+) reviews?\)|% recommend \((\d+) reviews?\)/);
  const total = said ? Number(said[1] ?? said[2]) : null;
  const titleOf = (s: Story) => JSON.stringify(s).match(/"text":"([^"]*?(?:doesn't recommend|recommends)[^"]*?)"/)?.[1] ?? "";
  const squash = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const SCAM = /copyright|violat|meta support|page (?:will be|has been) (?:disabled|restricted)/i;

  const skipped: string[] = [];
  const drafts: ReviewDraft[] = [];
  for (const s of stories.values()) {
    const story = (s.comet_sections as { content?: { story?: Record<string, unknown> } })?.content?.story as
      | { actors?: { name?: string; profile_picture?: { uri?: string } }[]; message?: { text?: string } }
      | undefined;
    const actor = story?.actors?.[0] ?? {};
    const name = (actor.name ?? "").trim();
    const text = (story?.message?.text ?? "").trim();
    if (squash(name).includes(squash(ownName))) {
      skipped.push(`The page's own post`);
      continue;
    }
    if (SCAM.test(name) || SCAM.test(text.slice(0, 200))) {
      skipped.push(`A scam post from “${name.slice(0, 40)}”`);
      continue;
    }
    if (!name || !text) {
      skipped.push(`${name || "Someone"}: no words`);
      continue;
    }
    const recommends = !/doesn't recommend/.test(titleOf(s));
    const avatarUrl = actor.profile_picture?.uri ?? null;
    drafts.push({
      key: `fb-${s.post_id}`,
      source: "facebook",
      name: name.slice(0, 80),
      body: clean(text).slice(0, 4000),
      rating: null,
      recommends,
      month: monthOfDate(new Date((s.creation_time ?? Date.now() / 1000) * 1000)),
      avatarUrl,
      avatar: pic(avatarUrl),
    });
  }
  return { source: "facebook", drafts: drafts.sort((a, b) => b.month.localeCompare(a.month)), total, skipped };
}

// ───────────────────────── Google ─────────────────────────

function google(entries: HarEntry[], pic: Pic, ownName: string): HarResult {
  const pages: unknown[] = [];
  let savedAt: string | null = null;
  for (const e of entries) {
    if (!/batchexecute\?rpcids=ocp93e/.test(e.request.url)) continue;
    savedAt = e.startedDateTime ?? savedAt;
    for (const line of textOf(e).replace(/^\)\]\}'\s*/, "").split("\n")) {
      if (!line.startsWith("[")) continue;
      try {
        for (const item of JSON.parse(line) as unknown[][]) {
          if (item[0] === "wrb.fr" && typeof item[2] === "string") pages.push(JSON.parse(item[2]));
        }
      } catch {
        /* not JSON */
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = pages.flatMap((p: any) => p?.[0]?.[0] ?? []) as any[];
  const decode = (s: string) =>
    s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  const ownWords = (raw: string | undefined) => {
    const text = decode(raw ?? "");
    const original = text.split(/\(Original\)/)[1];
    return (original ?? text.replace(/^\(Translated by Google\)\s*/, "")).trim();
  };
  const monthFrom = (ago: string | undefined) => {
    const d = new Date(savedAt ?? Date.now());
    const m = (ago ?? "").match(/(an?|\d+)\s+(day|week|month|year)s?\s+ago/i);
    if (m) {
      const n = /^an?$/i.test(m[1]) ? 1 : Number(m[1]);
      const unit = m[2].toLowerCase();
      if (unit === "day") d.setUTCDate(d.getUTCDate() - n);
      if (unit === "week") d.setUTCDate(d.getUTCDate() - 7 * n);
      if (unit === "month") d.setUTCMonth(d.getUTCMonth() - n);
      if (unit === "year") d.setUTCFullYear(d.getUTCFullYear() - n);
    }
    return monthOfDate(d);
  };

  const skipped: string[] = [];
  const drafts: ReviewDraft[] = [];
  list.forEach(([source, r], i) => {
    if (source?.[0] !== "Google") return void skipped.push(`Not a Google review (${source?.[0] ?? "?"})`);
    const name = String(r?.[0]?.[0] ?? "").trim();
    if (!name) return;
    if (name.toLowerCase().includes(ownName.toLowerCase())) return void skipped.push(`Posted by the resort itself: “${name}”`);
    const rating = Number(r?.[2]?.[0]);
    if (!(rating >= 1 && rating <= 5)) return;
    const avatarUrl: string | null = r?.[0]?.[2]?.[0] ?? null;
    drafts.push({
      key: `g-${i}-${name}`,
      source: "google",
      name: name.slice(0, 80),
      body: ownWords(r?.[3]?.[0]?.[0]?.[1]).slice(0, 4000),
      rating,
      recommends: null,
      month: monthFrom(r?.[1]),
      avatarUrl,
      avatar: pic(avatarUrl),
    });
  });
  return { source: "google", drafts: drafts.sort((a, b) => b.month.localeCompare(a.month)), total: null, skipped };
}

// ───────────────────────── Airbnb ─────────────────────────

function airbnb(entries: HarEntry[], pic: Pic): HarResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews = new Map<string, any>();
  let total: number | null = null;
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const x = o as any;
    if (x.__typename === "StayListingReview" || x.__typename === "PdpReview") return void reviews.set(String(x.id), x);
    if (x.__typename === "PageInfoWithCount" && typeof x.totalCount === "number") total = x.totalCount;
    for (const v of Object.values(o)) walk(v);
  };
  for (const e of entries) {
    if (!/airbnb\.[^/]+\/api\/v3\//.test(e.request.url)) continue;
    try {
      walk(JSON.parse(textOf(e)));
    } catch {
      /* not JSON */
    }
  }
  const letter = (url: string | null | undefined) => !url || /\/im\/Portrait\/Avatars\//.test(url);
  const drafts: ReviewDraft[] = [...reviews.values()]
    .map((r) => {
      const who = r.contextualReviewer ?? r.reviewer ?? {};
      const url: string | null = who.userRepresentationUrl?.profilePictureUrl ?? who.pictureUrl ?? null;
      const rating = Number(r.displayRating ?? r.rating);
      return {
        key: `ab-${r.id}`,
        source: "airbnb" as const,
        name: String(who.displayFirstName ?? who.firstName ?? "Guest").trim().slice(0, 80),
        body: clean(String(r.commentV2 ?? r.comments ?? "")).slice(0, 4000),
        rating: rating >= 1 && rating <= 5 ? rating : null,
        recommends: null,
        month: monthOfDate(new Date(r.createdAt ?? Date.now())),
        avatarUrl: letter(url) ? null : url,
        avatar: letter(url) ? null : pic(url),
      };
    })
    .filter((d) => d.rating != null && d.body)
    .sort((a, b) => b.month.localeCompare(a.month));
  return { source: "airbnb", drafts, total, skipped: [] };
}

// ───────────────────────── matching what's already in ─────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export interface ExistingReview {
  id: string;
  source: ReviewSource;
  reviewer_name: string;
  body: string;
  avatar_path?: string | null;
}

export type Match =
  | { kind: "new" }
  | { kind: "same"; id: string }
  /** Already in, but the import brings its picture or its full words. */
  | { kind: "improve"; id: string; avatar: boolean; body: boolean };

export function matchDraft(d: ReviewDraft, existing: ExistingReview[]): Match {
  const mine = existing.filter((r) => r.source === d.source && norm(r.reviewer_name) === norm(d.name));
  const hit =
    mine.find((r) => norm(r.body).slice(0, 60) === norm(d.body).slice(0, 60)) ??
    // A copy cut short (the site's launch reviews) still counts as the same one.
    mine.find((r) => norm(d.body).startsWith(norm(r.body).replace(/[.…]+$/, "").slice(0, 40)));
  if (!hit) return { kind: "new" };
  const avatar = !hit.avatar_path && Boolean(d.avatar || d.avatarUrl);
  const body = norm(d.body).length > norm(hit.body).length + 10;
  return avatar || body ? { kind: "improve", id: hit.id, avatar, body } : { kind: "same", id: hit.id };
}

/** Low stars or "doesn't recommend" go in hidden: on file, off the website. */
export const startsHidden = (d: ReviewDraft) => (d.rating != null ? d.rating <= 3 : d.recommends === false);
