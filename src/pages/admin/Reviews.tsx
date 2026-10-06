import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, MessageSquareReply, Star } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { prettyDate, stayRange } from "../../lib/format";
import { REVIEWS } from "../../lib/site";
import { cn } from "../../lib/utils";
import type { Review } from "../../lib/types";
import { Button, Card, EmptyState, Modal, PageHeader, Spinner, StatTile, Tabs, Textarea } from "../../components/ui";
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
  const published = groups.published;
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : null;

  async function setStatus(r: Row, status: View) {
    const { error } = await supabase.from("reviews").update({ status }).eq("id", r.id);
    if (error) return void toast.error(errorMessage(error));
    await qc.invalidateQueries({ queryKey: ["reviews"] });
    toast.success(status === "published" ? "Published on the website" : status === "hidden" ? "Hidden" : "Moved back");
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
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label="Average rating" value={avg ? `★ ${avg.toFixed(2)}` : "—"} sub={`${published.length} published`} />
        <StatTile label="Waiting for you" value={groups.pending.length} tone={groups.pending.length ? "warn" : "default"} />
        <StatTile label="Facebook recommendations" value={REVIEWS.length} sub="Shown alongside, from lib/site.ts" />
      </div>

      <Tabs
        className="mb-4"
        value={view}
        onChange={setView}
        items={[
          { value: "pending", label: "To publish", count: groups.pending.length },
          { value: "published", label: "Published", count: groups.published.length },
          { value: "hidden", label: "Hidden", count: groups.hidden.length },
        ]}
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <Card className="p-6 text-sm text-ink-muted">
          Reviews aren't set up yet. Run the latest <code className="rounded bg-sand-100 px-1">supabase/schema.sql</code> in
          Supabase.
        </Card>
      ) : groups[view].length === 0 ? (
        <Card>
          <EmptyState icon={<Star />} title={view === "pending" ? "All caught up" : "Nothing here"} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups[view].map((r) => (
            <Card key={r.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{r.guest?.full_name ?? "Guest"}</p>
                  <p className="text-xs text-ink-muted">
                    {r.booking ? `${r.booking.ref} · ${stayRange(r.booking.check_in, r.booking.check_out)}` : ""} · written{" "}
                    {prettyDate(r.created_at.slice(0, 10), "MMM d")}
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
                  <Button size="sm" onClick={() => setStatus(r, "published")}>
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
              </div>
            </Card>
          ))}
        </div>
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
    </>
  );
}
