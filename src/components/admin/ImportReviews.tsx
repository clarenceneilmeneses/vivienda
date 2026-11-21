import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, FileUp, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { matchDraft, parseHar, startsHidden, type ExistingReview, type HarResult, type Match, type ReviewDraft } from "../../lib/review-import";
import { REVIEW_SOURCE_LABEL, type ReviewSource } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Badge, Button, ErrorBox, Modal } from "../ui";
import { Stars } from "../public/StayBits";
import { REVIEW_AVATAR_BUCKET, ReviewerAvatar, SourceLogo } from "../public/Reviews";

/**
 * Import reviews from a browser recording (HAR), as Malaya does, but from
 * here instead of a script: drop the file, see what's in it against what's
 * already on file, tick, import. Pictures are re-hosted in review-avatars.
 */

const HOW_TO: { source: ReviewSource; steps: string[] }[] = [
  {
    source: "facebook",
    steps: [
      "On a computer (not phone mode), logged in to Facebook, open the page's Reviews tab.",
      "Press F12 → Network. Tick “Preserve log”, then press F5 to reload.",
      "Scroll down to the very last review, so every one loads.",
      "Click the download arrow in the Network toolbar (Export HAR) and save the file.",
    ],
  },
  {
    source: "google",
    steps: [
      "Search the resort on Google, open its panel and click Reviews (google.com/travel).",
      "F12 → Network, tick “Preserve log”, F5, open Reviews again.",
      "Scroll to the very last review.",
      "Download arrow in the Network toolbar → save the .har file.",
    ],
  },
  {
    source: "airbnb",
    steps: [
      "Open the host profile on Airbnb (airbnb.com/users/profile/…).",
      "F12 → Network, tick “Preserve log”, then “Show all reviews”.",
      "Scroll the popup to the very last review.",
      "Download arrow in the Network toolbar → save the .har file.",
    ],
  },
];

type Row = { d: ReviewDraft; match: Match; preview: string | null };

export function ImportReviewsModal({ existing, onClose }: { existing: ExistingReview[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<HarResult | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [howTo, setHowTo] = useState<ReviewSource | null>("facebook");

  const rows: Row[] = useMemo(
    () =>
      (result?.drafts ?? []).map((d) => ({
        d,
        match: matchDraft(d, existing),
        preview: d.avatar ? URL.createObjectURL(d.avatar) : d.source === "facebook" ? null : d.avatarUrl,
      })),
    [result, existing],
  );
  // The object URLs for the pictures are let go with the list.
  useEffect(() => () => rows.forEach((r) => r.preview?.startsWith("blob:") && URL.revokeObjectURL(r.preview)), [rows]);

  async function read(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const res = parseHar(await file.text());
      if (!res.source) throw new Error("No Facebook, Google or Airbnb reviews in that recording. Follow the steps below and record again.");
      if (res.drafts.length === 0)
        throw new Error(`The recording is from ${REVIEW_SOURCE_LABEL[res.source]}, but no reviews loaded in it. Scroll through the reviews while recording.`);
      setResult(res);
      // New ones and ones that bring a picture or fuller words start ticked.
      setPicked(new Set(res.drafts.filter((d) => matchDraft(d, existing).kind !== "same").map((d) => d.key)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  async function uploadAvatar(d: ReviewDraft): Promise<string | null> {
    let blob = d.avatar;
    if (!blob && d.avatarUrl) {
      // Most platforms refuse a download from another site; then the address itself is kept,
      // except Facebook's, which expires within days.
      blob = await fetch(d.avatarUrl)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null);
      if (!blob) return d.source === "facebook" ? null : d.avatarUrl;
    }
    if (!blob) return null;
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${d.source}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(REVIEW_AVATAR_BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg" });
    if (error) {
      if (/bucket not found/i.test(error.message)) throw new Error("Profile pictures need the latest supabase/schema.sql. Run it in Supabase first.");
      return null;
    }
    return path;
  }

  async function run() {
    const chosen = rows.filter((r) => picked.has(r.d.key) && r.match.kind !== "same");
    if (!chosen.length) return;
    setBusy(true);
    setError(null);
    let added = 0;
    let updated = 0;
    let pictures = 0;
    try {
      for (const { d, match } of chosen) {
        if (match.kind === "improve") {
          const patch: Record<string, unknown> = {};
          if (match.avatar) {
            const path = await uploadAvatar(d);
            if (path) {
              patch.avatar_path = path;
              pictures++;
            }
          }
          if (match.body) patch.body = d.body;
          if (Object.keys(patch).length) {
            const { error } = await supabase.from("reviews").update(patch).eq("id", match.id);
            if (error) throw error;
            updated++;
          }
          continue;
        }
        const avatar_path = await uploadAvatar(d);
        if (avatar_path) pictures++;
        const { error } = await supabase.from("reviews").insert({
          source: d.source,
          reviewer_name: d.name,
          rating: d.rating,
          recommends: d.recommends,
          body: d.body || (d.rating ? `Rated ${d.rating} stars.` : ""),
          reviewed_on: d.month,
          avatar_path,
          status: startsHidden(d) ? "hidden" : "published",
        });
        if (error) throw error;
        added++;
      }
      toast.success(
        [added && `${added} review${added === 1 ? "" : "s"} added`, updated && `${updated} updated`, pictures && `${pictures} picture${pictures === 1 ? "" : "s"}`]
          .filter(Boolean)
          .join(" · ") || "Nothing to change",
      );
      await qc.invalidateQueries({ queryKey: ["reviews"] });
      onClose();
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        /avatar_path|recommends|null value in column "rating"/.test(msg)
          ? "Imports need the latest supabase/schema.sql. Run it in Supabase, then import again. Nothing after the first error was saved."
          : `${msg} (${added} added and ${updated} updated before it stopped.)`,
      );
      await qc.invalidateQueries({ queryKey: ["reviews"] });
    } finally {
      setBusy(false);
    }
  }

  const counts = {
    fresh: rows.filter((r) => r.match.kind === "new").length,
    improve: rows.filter((r) => r.match.kind === "improve").length,
    same: rows.filter((r) => r.match.kind === "same").length,
  };
  const chosenCount = rows.filter((r) => picked.has(r.d.key) && r.match.kind !== "same").length;
  const toggle = (k: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <Modal
      open
      size="lg"
      onClose={busy ? () => undefined : onClose}
      title="Import reviews"
      description="From a recording of your Facebook, Google or Airbnb reviews page (a .har file). Nothing is saved until you press Import."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {result && (
            <Button loading={busy} disabled={!chosenCount} onClick={run}>
              Import {chosenCount || ""}
            </Button>
          )}
        </>
      }
    >
      {!result ? (
        <div className="space-y-4">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand-300 px-4 py-10 text-center hover:border-brand-500",
              reading && "pointer-events-none opacity-60",
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              read(e.dataTransfer.files?.[0]);
            }}
          >
            <FileUp className="size-7 text-brand-700" />
            <span className="font-medium text-ink">{reading ? "Reading the recording…" : "Drop the .har file here, or click to choose"}</span>
            <span className="text-xs text-ink-muted">Facebook, Google or Airbnb. It's read on this computer.</span>
            <input type="file" accept=".har,application/json" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
          </label>
          <ErrorBox>{error}</ErrorBox>
          <div className="divide-y divide-sand-200 rounded-xl border border-sand-200">
            {HOW_TO.map((h) => (
              <div key={h.source}>
                <button
                  type="button"
                  onClick={() => setHowTo(howTo === h.source ? null : h.source)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-ink"
                >
                  <SourceLogo source={h.source} className="size-4" /> How to record your {REVIEW_SOURCE_LABEL[h.source]} reviews
                  <ChevronDown className={cn("ml-auto size-4 text-ink-muted transition-transform", howTo === h.source && "rotate-180")} />
                </button>
                {howTo === h.source && (
                  <ol className="list-decimal space-y-1 px-4 pb-4 pl-9 text-sm text-ink-soft">
                    {h.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <SourceLogo source={result.source!} className="size-5" />
            <span className="font-medium text-ink">
              {rows.length} {REVIEW_SOURCE_LABEL[result.source!]} review{rows.length === 1 ? "" : "s"}
              {result.total != null && ` of the ${result.total} the page reports`}
            </span>
            <span className="text-ink-muted">
              · {counts.fresh} new · {counts.improve} to update · {counts.same} already in
            </span>
          </div>
          {result.total != null && rows.length < result.total && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {result.total - rows.length} didn't load in the recording. Scroll to the very last review while recording to get them all.
            </p>
          )}
          <div className="flex items-center gap-3 text-xs">
            <button type="button" className="cursor-pointer text-brand-700 hover:underline" onClick={() => setPicked(new Set(rows.filter((r) => r.match.kind !== "same").map((r) => r.d.key)))}>
              Tick all
            </button>
            <button type="button" className="cursor-pointer text-ink-muted hover:underline" onClick={() => setPicked(new Set())}>
              Untick all
            </button>
            <button type="button" className="ml-auto cursor-pointer text-ink-muted hover:underline" onClick={() => setResult(null)}>
              Choose another file
            </button>
          </div>
          <ul className="max-h-[52vh] divide-y divide-sand-200 overflow-y-auto rounded-xl border border-sand-200">
            {rows.map(({ d, match, preview }) => {
              const same = match.kind === "same";
              return (
                <li key={d.key}>
                  <label className={cn("flex cursor-pointer gap-3 px-3 py-3", same && "cursor-default opacity-55")}>
                    <input
                      type="checkbox"
                      className="mt-3 size-4 shrink-0 accent-brand-700"
                      checked={!same && picked.has(d.key)}
                      disabled={same}
                      onChange={() => toggle(d.key)}
                    />
                    <ReviewerAvatar name={d.name} url={preview} className="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{d.name}</span>
                        {d.rating != null ? (
                          <Stars rating={d.rating} />
                        ) : d.recommends ? (
                          <ThumbsUp className="size-3.5 text-[#0866FF]" />
                        ) : (
                          <ThumbsDown className="size-3.5 text-red-700" />
                        )}
                        <span className="text-xs text-ink-muted">{d.month.slice(0, 7)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{d.body || "No words, stars only."}</span>
                    </span>
                    <span className="shrink-0 pt-0.5">
                      {match.kind === "new" ? (
                        startsHidden(d) ? (
                          <Badge className="bg-amber-50 text-amber-800">New · hidden</Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-800">New</Badge>
                        )
                      ) : match.kind === "improve" ? (
                        <Badge className="bg-sky-50 text-sky-800">{match.avatar ? "Adds picture" : "Fuller text"}</Badge>
                      ) : (
                        <Badge>Already in</Badge>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-muted">
            3 stars or fewer and “doesn't recommend” come in hidden: on file here, off the website until you publish them.
          </p>
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
    </Modal>
  );
}
