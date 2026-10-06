import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, type LucideIcon } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { useSettings } from "../../lib/queries";
import type { Settings } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui";

/**
 * The pieces every Settings tab is built from, after Malaya's settings
 * screens: a card per topic with an icon and a display title, a quiet note
 * card for "how this works", and a save bar that appears once something
 * changed.
 */

export function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-sand-200/80 bg-white shadow-level-1", className)}>
      <header className="px-5 pt-5 pb-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-medium text-ink">
          <Icon className="size-[18px] shrink-0 text-brand-700" aria-hidden /> {title}
        </h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export function SettingsNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-sand-200 bg-sand-50 p-4">
      <Info className="mt-0.5 size-4 shrink-0 text-ink-muted" />
      <div className="space-y-1 text-sm">
        <p className="font-semibold text-ink">{title}</p>
        <div className="space-y-2 text-ink-muted">{children}</div>
      </div>
    </div>
  );
}

export function SettingsHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-medium text-ink sm:text-[26px]">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
    </div>
  );
}

type Draft = Omit<Settings, "id">;

/** One draft of the settings row, shared by whichever fields a tab shows. */
export function useSettingsDraft() {
  const qc = useQueryClient();
  const { data, isLoading } = useSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !draft) {
      const { id: _id, ...rest } = data;
      void _id;
      setDraft(rest);
    }
  }, [data, draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const text = (key: keyof Draft) => ({
    value: String(draft?.[key] ?? ""),
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });
  const dirty = Boolean(
    data && draft && JSON.stringify({ ...data, id: undefined }) !== JSON.stringify({ ...draft, id: undefined }),
  );

  async function save() {
    if (!draft) return;
    if (draft.admin_notify_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.admin_notify_email)) {
      toast.error("The notification email doesn't look right.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({
        ...draft,
        downpayment_percent: Math.min(100, Math.max(0, Number(draft.downpayment_percent) || 0)),
        reminder_days_before: Math.min(14, Math.max(0, Number(draft.reminder_days_before) || 0)),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return void toast.error(errorMessage(error));
    toast.success("Settings saved");
    await qc.invalidateQueries({ queryKey: ["settings"] });
    setDraft(null);
  }

  return { draft, set, text, dirty, save, saving, loading: isLoading || !draft, discard: () => setDraft(null) };
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 mt-6 lg:bottom-4">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-full border border-sand-200 bg-white/95 py-2 pr-2 pl-5 shadow-level-4 backdrop-blur">
        <span className="text-sm text-ink-muted">Unsaved changes</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} loading={saving} className="rounded-full px-4">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
