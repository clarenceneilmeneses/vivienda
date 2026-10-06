import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import type { QuickReply } from "../../lib/types";
import { Button, Field, Input, Textarea } from "../ui";


export function useQuickReplies() {
  return useQuery({
    queryKey: ["inbox", "quick-replies"],
    queryFn: async (): Promise<QuickReply[]> => {
      const { data, error } = await supabase.from("quick_replies").select("*").order("sort_order").order("created_at");
      if (error) return [];
      return (data ?? []) as QuickReply[];
    },
  });
}

/** Add, edit and delete the saved answers used in the Inbox. */
export function QuickRepliesManager() {
  const qc = useQueryClient();
  const { data: replies = [] } = useQuickReplies();
  const [editing, setEditing] = useState<Partial<QuickReply> | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing?.title?.trim() || !editing.body?.trim()) return;
    setBusy(true);
    const values = { title: editing.title.trim(), body: editing.body.trim() };
    const { error } = editing.id
      ? await supabase.from("quick_replies").update(values).eq("id", editing.id)
      : await supabase.from("quick_replies").insert({ ...values, sort_order: replies.length });
    setBusy(false);
    if (error) return void toast.error(errorMessage(error));
    setEditing(null);
    await qc.invalidateQueries({ queryKey: ["inbox", "quick-replies"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this quick reply?")) return;
    const { error } = await supabase.from("quick_replies").delete().eq("id", id);
    if (error) return void toast.error(errorMessage(error));
    await qc.invalidateQueries({ queryKey: ["inbox", "quick-replies"] });
  }

  return (
    <div>
      {editing ? (
        <div className="space-y-4">
          <Field label="Title" hint="A short label, like “Payment details”.">
            {(id) => (
              <Input id={id} value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            )}
          </Field>
          <Field label="Message">
            {(id) => (
              <Textarea
                id={id}
                rows={6}
                value={editing.body ?? ""}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save} disabled={!editing.title?.trim() || !editing.body?.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-sand-200">
            {replies.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-3.5">
                <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 cursor-pointer text-left">
                  <span className="block text-sm font-medium text-ink">{r.title}</span>
                  <span className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{r.body}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="cursor-pointer rounded-md p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-700"
                  aria-label={`Delete ${r.title}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {replies.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">No quick replies yet.</li>}
          </ul>
          <Button className="mt-4" variant="secondary" onClick={() => setEditing({ title: "", body: "" })}>
            <Plus className="size-4" /> Add quick reply
          </Button>
        </>
      )}
    </div>
  );
}
