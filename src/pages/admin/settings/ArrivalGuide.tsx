import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpenText, Car, KeyRound, LifeBuoy, Wifi } from "lucide-react";
import { errorMessage, supabase } from "../../../lib/supabase";
import type { ArrivalGuide as Guide } from "../../../lib/types";
import { Card, Field, Input, Spinner, Textarea } from "../../../components/ui";
import { SaveBar, SettingsCard, SettingsHeading, SettingsNote } from "../../../components/admin/SettingsKit";

const EMPTY: Guide = { check_in_method: "", wifi_name: "", wifi_password: "", parking: "", house_manual: "", emergency: "" };

/**
 * Settings → Arrival guide, as in Malaya: how guests get in, the wifi, parking
 * and the house manual. Kept apart from the public settings, so only guests
 * with a confirmed booking ever see it, on their trip page.
 */
export default function ArrivalGuide() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["arrival-guide"],
    queryFn: async (): Promise<Guide> => {
      const { data, error } = await supabase.from("arrival_guide").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return pick({ ...EMPTY, ...(data ?? {}) } as Guide);
    },
  });
  const [draft, setDraft] = useState<Guide | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data && !draft) setDraft(data);
  }, [data, draft]);

  if (isLoading) return <Spinner />;
  if (error) {
    return (
      <Card className="max-w-2xl p-6 text-sm text-ink-muted">
        The arrival guide isn't set up yet. Run the latest <code className="rounded bg-sand-100 px-1">supabase/schema.sql</code>{" "}
        in Supabase, then come back.
      </Card>
    );
  }
  if (!draft) return <Spinner />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(data);
  const field = (k: keyof Guide) => ({ value: draft[k], onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value }) });

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("arrival_guide").upsert({ id: 1, ...draft, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return void toast.error(errorMessage(error));
    toast.success("Arrival guide saved");
    await qc.invalidateQueries({ queryKey: ["arrival-guide"] });
    setDraft(null);
  }

  return (
    <div className="max-w-4xl space-y-4">
      <SettingsHeading
        title="Arrival guide"
        description="What guests need on the day. It appears on their trip page once you confirm the booking, and never on the public site."
      />

      <SettingsCard icon={KeyRound} title="Checking in">
        <Field label="How to check in" hint="Who meets them, where the key is, what to show at the gate.">
          {(id) => <Textarea id={id} rows={4} {...field("check_in_method")} placeholder="Our caretaker, Kuya Ben, will meet you at the gate…" />}
        </Field>
      </SettingsCard>

      <SettingsCard icon={Wifi} title="Wifi">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Network name">{(id) => <Input id={id} {...field("wifi_name")} />}</Field>
          <Field label="Password" hint="Guests can tap it to copy.">
            {(id) => <Input id={id} {...field("wifi_password")} />}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard icon={Car} title="Parking">
        <Field label="Parking" optional>
          {(id) => <Textarea id={id} rows={3} {...field("parking")} placeholder="Room for 3 cars inside the gate…" />}
        </Field>
      </SettingsCard>

      <SettingsCard icon={BookOpenText} title="House manual">
        <Field label="House manual" optional hint="The aircon, the pool lights, the videoke, where the trash goes.">
          {(id) => <Textarea id={id} rows={8} {...field("house_manual")} />}
        </Field>
      </SettingsCard>

      <SettingsCard icon={LifeBuoy} title="Emergencies">
        <Field label="Emergencies and contacts" optional hint="Caretaker's number, the nearest hospital, barangay hall.">
          {(id) => <Textarea id={id} rows={4} {...field("emergency")} />}
        </Field>
      </SettingsCard>

      <SettingsNote title="Who sees this">
        <p>
          Only signed-in guests whose booking is confirmed or in progress. A pending request, a past stay or anyone else on
          the site sees nothing here.
        </p>
      </SettingsNote>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setDraft(null)} />
    </div>
  );
}

function pick(g: Guide): Guide {
  return {
    check_in_method: g.check_in_method ?? "",
    wifi_name: g.wifi_name ?? "",
    wifi_password: g.wifi_password ?? "",
    parking: g.parking ?? "",
    house_manual: g.house_manual ?? "",
    emergency: g.emergency ?? "",
  };
}
