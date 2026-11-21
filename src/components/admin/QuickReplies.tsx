import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Send, Trash2 } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import type { QuickReply } from "../../lib/types";
import { Badge, Button, Field, Input, Select, Textarea } from "../ui";

const AUTO_LABEL: Record<NonNullable<QuickReply["auto_send"]>, string> = {
  booking_created: "When a booking is made",
  booking_confirmed: "When a booking is confirmed",
};


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
    const values = { title: editing.title.trim(), body: editing.body.trim(), auto_send: editing.auto_send ?? null };
    // One automatic reply per moment: picking it here takes it off any other.
    if (values.auto_send) {
      const others = replies.filter((r) => r.auto_send === values.auto_send && r.id !== editing.id);
      if (others.length) await supabase.from("quick_replies").update({ auto_send: null }).in("id", others.map((r) => r.id));
    }
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
          <Field
            label="Send by itself"
            hint="Posted in the guest's conversation as the resort, the moment it happens. {ref} and {dates} work here too."
          >
            {(id) => (
              <Select
                id={id}
                value={editing.auto_send ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, auto_send: (e.target.value || null) as QuickReply["auto_send"] })
                }
              >
                <option value="">Never, I'll pick it myself</option>
                {Object.entries(AUTO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
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
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {r.title}
                    {r.auto_send && (
                      <Badge className="bg-brand-50 text-brand-700">
                        <Send className="mr-1 size-3" /> {AUTO_LABEL[r.auto_send]}
                      </Badge>
                    )}
                  </span>
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
          <Button className="mt-4" variant="secondary" onClick={() => setEditing({ title: "", body: "", auto_send: null })}>
            <Plus className="size-4" /> Add quick reply
          </Button>
        </>
      )}
    </div>
  );
}
