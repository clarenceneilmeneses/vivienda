import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, MessageSquareReply, Plus, Star, Trash2 } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { isoDate, prettyDate, stayRange } from "../../lib/format";
import { REVIEWS } from "../../lib/site";
import { cn } from "../../lib/utils";
import { REVIEW_SOURCE_LABEL, type Review, type ReviewSource } from "../../lib/types";
import {
  ask,
  Badge,
  Button,
  Card,
  ClearFilters,
  EmptyState,
  ErrorBox,
  Field,
  FilterSelect,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchField,
  Select,
  Spinner,
  StatTile,
  Tabs,
  Textarea,
  Toolbar,
  ToolbarGroup,
  usePaged,
} from "../../components/ui";
import { Stars } from "../../components/public/StayBits";

type Row = Review & {
  guest: { full_name: string; email: string | null } | null;
  booking: { ref: string; check_in: string; check_out: string } | null;
};
type View = Review["status"];


export default function Reviews() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("pending");
  const [replying, setReplying] = useState<Row | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [stars, setStars] = useState("any");
  const [source, setSource] = useState<"any" | ReviewSource>("any");
  const [replied, setReplied] = useState<"any" | "yes" | "no">("any");

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["reviews", "admin"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, guest:guests(full_name, email), booking:bookings(ref, check_in, check_out)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const groups = useMemo(() => {
    const list = rows ?? [];
    return {
      pending: list.filter((r) => r.status === "pending"),
      published: list.filter((r) => r.status === "published"),
      hidden: list.filter((r) => r.status === "hidden"),
    };
  }, [rows]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return groups[view].filter(
      (r) =>
        (stars === "any" || r.rating === Number(stars)) &&
        (source === "any" || (r.source ?? "website") === source) &&
        (replied === "any" || (replied === "yes") === Boolean(r.host_reply)) &&
        (!term ||
          [r.reviewer_name, r.guest?.full_name, r.guest?.email, r.booking?.ref, r.body].some((v) =>
            v?.toLowerCase().includes(term),
          )),
    );
  }, [groups, view, q, stars, source, replied]);
  const filtering = q !== "" || stars !== "any" || source !== "any" || replied !== "any";
  const paged = usePaged(shown, [view, q, stars, source, replied], 10);
  const published = groups.published;
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : null;

  async function setStatus(r: Row, status: View) {
    const { error } = await supabase.from("reviews").update({ status }).eq("id", r.id);
    if (error) return void toast.error(errorMessage(error));
    await qc.invalidateQueries({ queryKey: ["reviews"] });
    toast.success(status === "published" ? "Published on the website" : status === "hidden" ? "Hidden" : "Moved back");
  }

  async function remove(r: Row) {
    if (!(await ask({ title: `Delete ${r.reviewer_name || "this"}'s review?`, confirmLabel: "Delete review" }))) return;
    const { error } = await supabase.from("reviews").delete().eq("id", r.id);
    if (error) return void toast.error(errorMessage(error));
    await qc.invalidateQueries({ queryKey: ["reviews"] });
    toast.success("Review deleted");
  }

  async function saveReply() {
    if (!replying) return;
    setBusy(true);
    const { error } = await supabase
      .from("reviews")
      .update({ host_reply: reply.trim(), host_replied_at: reply.trim() ? new Date().toISOString() : null })
      .eq("id", replying.id);
    setBusy(false);
    if (error) return void toast.error(errorMessage(error));
    setReplying(null);
    await qc.invalidateQueries({ queryKey: ["reviews"] });
    toast.success("Reply saved");
  }

  return (
    <>
      <PageHeader
        eyebrow="Guests"
        title="Reviews"
        description="Guests can review their stay from their Trips page after checkout. Nothing shows on the website until you publish it."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add a review
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Average rating" value={avg ? `★ ${avg.toFixed(2)}` : "—"} sub={`${published.length} published`} />
        <StatTile label="Waiting for you" value={groups.pending.length} tone={groups.pending.length ? "warn" : "default"} />
        <StatTile
          label="From other platforms"
          value={(rows ?? []).filter((r) => (r.source ?? "website") !== "website").length}
          sub="Airbnb, Google, Facebook"
        />
        <StatTile label="Facebook recommendations" value={REVIEWS.length} sub="Shown beside the reviews" />
      </div>

      <Toolbar>
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: "pending", label: "To publish", count: groups.pending.length },
            { value: "published", label: "Published", count: groups.published.length },
            { value: "hidden", label: "Hidden", count: groups.hidden.length },
          ]}
        />
        <SearchField value={q} onChange={setQ} placeholder="Search name, ref, words" />
      </Toolbar>
      <ToolbarGroup className="mb-4">
        <FilterSelect
          label="Rating"
          value={stars}
          onChange={setStars}
          options={[
            { value: "any", label: "Any rating" },
            ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)} ${n} star${n > 1 ? "s" : ""}` })),
          ]}
        />
        <FilterSelect
          label="Source"
          value={source}
          onChange={setSource}
          options={[
            { value: "any" as const, label: "All sources" },
            ...(Object.keys(REVIEW_SOURCE_LABEL) as ReviewSource[]).map((k) => ({ value: k, label: REVIEW_SOURCE_LABEL[k] })),
          ]}
        />
        <FilterSelect
          label="Reply"
          value={replied}
          onChange={setReplied}
          options={[
            { value: "any", label: "Replied or not" },
            { value: "no", label: "Not replied" },
            { value: "yes", label: "Replied" },
          ]}
        />
        <ClearFilters
          active={filtering}
          onClear={() => {
            setQ("");
            setStars("any");
            setSource("any");
            setReplied("any");
          }}
        />
      </ToolbarGroup>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <Card className="p-6 text-sm text-ink-muted">
          Reviews aren't set up yet. Run the latest <code className="rounded bg-sand-100 px-1">supabase/schema.sql</code> in
          Supabase.
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Star />} title={filtering ? "No matches" : view === "pending" ? "All caught up" : "Nothing here"} />
        </Card>
      ) : (
        <>
        <div className="grid gap-4 lg:grid-cols-2">
          {paged.items.map((r) => (
            <Card key={r.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    {r.reviewer_name || r.guest?.full_name || "Guest"}
                    <Badge className={(r.source ?? "website") === "website" ? "bg-emerald-50 text-emerald-800" : ""}>
                      {REVIEW_SOURCE_LABEL[r.source ?? "website"]}
                    </Badge>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {r.booking
                      ? `${r.booking.ref} · ${stayRange(r.booking.check_in, r.booking.check_out)} · written ${prettyDate(r.created_at.slice(0, 10), "MMM d")}`
                      : r.reviewed_on
                        ? `Reviewed ${prettyDate(r.reviewed_on, "MMM d, yyyy")}`
                        : `Added ${prettyDate(r.created_at.slice(0, 10), "MMM d")}`}
                  </p>
                </div>
                <Stars rating={r.rating} />
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed whitespace-pre-line text-ink-soft">{r.body}</p>
              {r.host_reply && (
                <p className="mt-3 rounded-xl bg-sand-100 px-3 py-2 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">Your reply: </span>
                  {r.host_reply}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-sand-200 pt-4">
                {r.status !== "published" && (
                  <Button size="sm" variant="success" onClick={() => setStatus(r, "published")}>
                    <Eye className="size-3.5" /> Publish
                  </Button>
                )}
                {r.status !== "hidden" && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(r, "hidden")}>
                    <EyeOff className="size-3.5" /> Hide
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(r.host_reply && "text-brand-700")}
                  onClick={() => {
                    setReply(r.host_reply);
                    setReplying(r);
                  }}
                >
                  <MessageSquareReply className="size-3.5" /> {r.host_reply ? "Edit reply" : "Reply publicly"}
                </Button>
                {!r.booking_id && (
                  <Button size="sm" variant="danger" className="ml-auto" onClick={() => remove(r)}>
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
        <Card className="mt-4 overflow-hidden [&>div]:border-t-0">
          <Pagination paged={paged} noun="review" />
        </Card>
        </>
      )}

      <Modal
        open={Boolean(replying)}
        onClose={() => setReplying(null)}
        title="Public reply"
        description="Shown under the review on the website. Keep it warm and short."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplying(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={saveReply}>
              Save reply
            </Button>
          </>
        }
      >
        <Textarea rows={5} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Thank you for staying with us…" />
      </Modal>
      {adding && <AddReviewModal onClose={() => setAdding(false)} />}
    </>
  );
}

/** A review from Airbnb, Google or Facebook, typed in so it shows beside the website's own. */
function AddReviewModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [source, setSource] = useState<ReviewSource>("airbnb");
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [date, setDate] = useState(isoDate(new Date()));
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Who wrote it? A first name and initial is enough.");
    if (body.trim().length < 5) return setError("Paste the review text.");
    setSaving(true);
    const { error } = await supabase.from("reviews").insert({
      source,
      reviewer_name: name.trim(),
      rating,
      body: body.trim(),
      reviewed_on: date || null,
      status: publish ? "published" : "pending",
    });
    setSaving(false);
    if (error) return setError(errorMessage(error));
    await qc.invalidateQueries({ queryKey: ["reviews"] });
    toast.success(publish ? "Review added and published" : "Review added");
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a review"
      description="Bring over a review from Airbnb, Google or Facebook. It shows on the site with where it came from."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Add review
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">
            {(id) => (
              <Select id={id} value={source} onChange={(e) => setSource(e.target.value as ReviewSource)}>
                {(["airbnb", "google", "facebook", "other"] as const).map((s) => (
                  <option key={s} value={s}>
                    {REVIEW_SOURCE_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reviewed on" optional>
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
        <Field label="Name" hint="As shown on the platform, e.g. Maria S.">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Rating</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setRating(n)}
                className="cursor-pointer p-0.5"
              >
                <Star className={cn("size-7", n <= rating ? "fill-brand-700 text-brand-700" : "text-sand-300")} />
              </button>
            ))}
          </div>
        </div>
        <Field label="Review">{(id) => <Textarea id={id} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="size-4 accent-brand-700" />
          Publish on the website now
        </label>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Modal>
  );
}
