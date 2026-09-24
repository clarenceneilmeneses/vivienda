import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { useSettings } from "../../lib/queries";
import type { Settings } from "../../lib/types";
import { Button, Card, CardHeader, Field, Input, PageHeader, Spinner, Switch, Textarea } from "../../components/ui";

type Draft = Omit<Settings, "id">;

export default function SettingsPage() {
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

  if (isLoading || !draft) return <Spinner />;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const text = (key: keyof Draft) => ({
    value: String(draft[key] ?? ""),
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });
  const dirty = data ? JSON.stringify({ ...data, id: undefined }) !== JSON.stringify({ ...draft, id: undefined }) : false;

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
    if (error) return toast.error(errorMessage(error));
    toast.success("Settings saved");
    await qc.invalidateQueries({ queryKey: ["settings"] });
    setDraft(null);
  }

  return (
    <>
      <PageHeader
        title="Settings"
        actions={
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save className="size-4" /> Save changes
          </Button>
        }
      />
      <div className="space-y-4 pb-20">
        <Section title="Resort" description="Shown on the website and in emails.">
          <Field label="Resort name">{(id) => <Input id={id} {...text("resort_name")} />}</Field>
          <Field label="Tagline" optional>{(id) => <Input id={id} {...text("tagline")} />}</Field>
          <Field label="About" optional hint="A short paragraph for the home page." className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={3} {...text("about")} />}
          </Field>
          <Field label="Contact email" optional>{(id) => <Input id={id} type="email" {...text("email")} />}</Field>
          <Field label="Contact number" optional>{(id) => <Input id={id} {...text("phone")} />}</Field>
          <Field label="Address" optional>{(id) => <Input id={id} {...text("address")} />}</Field>
          <Field label="Google Maps link" optional>{(id) => <Input id={id} {...text("map_url")} placeholder="https://maps.app.goo.gl/…" />}</Field>
          <Field label="Facebook page" optional className="sm:col-span-2">
            {(id) => <Input id={id} {...text("facebook_url")} placeholder="https://facebook.com/yourresort" />}
          </Field>
        </Section>

        <Section title="Stays">
          <Field label="Check-in time">{(id) => <Input id={id} type="time" {...text("check_in_time")} />}</Field>
          <Field label="Check-out time">{(id) => <Input id={id} type="time" {...text("check_out_time")} />}</Field>
          <Field label="Downpayment (%)" hint="Shown to guests when they book. 0 = no downpayment.">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={100}
                value={draft.downpayment_percent}
                onChange={(e) => set("downpayment_percent", Number(e.target.value))}
              />
            )}
          </Field>
        </Section>

        <Section title="Payment details" description="Guests see these on the booking page and in emails.">
          <Field label="GCash number" optional>{(id) => <Input id={id} {...text("gcash_number")} />}</Field>
          <Field label="GCash account name" optional>{(id) => <Input id={id} {...text("gcash_name")} />}</Field>
          <Field label="Bank" optional>{(id) => <Input id={id} {...text("bank_name")} placeholder="e.g. BDO" />}</Field>
          <Field label="Bank account name" optional>{(id) => <Input id={id} {...text("bank_account_name")} />}</Field>
          <Field label="Bank account number" optional>{(id) => <Input id={id} {...text("bank_account_number")} />}</Field>
          <Field label="Payment instructions" optional className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} {...text("payment_instructions")} />}
          </Field>
        </Section>

        <Section title="Emails">
          <div className="sm:col-span-2">
            <Switch
              checked={draft.send_emails}
              onChange={(v) => set("send_emails", v)}
              label="Send emails to guests"
              description="Booking received, confirmed, declined, cancelled, payment receipts and arrival reminders."
            />
          </div>
          <Field label="Send new-booking alerts to" hint="Where you want to hear about new website bookings.">
            {(id) => <Input id={id} type="email" {...text("admin_notify_email")} />}
          </Field>
          <Field label="Arrival reminder" hint="Days before check-in. 0 turns reminders off.">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={14}
                value={draft.reminder_days_before}
                onChange={(e) => set("reminder_days_before", Number(e.target.value))}
              />
            )}
          </Field>
        </Section>

        <Section title="Policies" description="Guests must accept the agreement before booking.">
          <Field label="House rules" optional className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={5} {...text("house_rules")} />}
          </Field>
          <Field label="Cancellation policy" optional className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={4} {...text("cancellation_policy")} />}
          </Field>
          <Field
            label="Guest agreement / waiver"
            optional
            hint="If blank, guests agree to the house rules and cancellation policy above."
            className="sm:col-span-2"
          >
            {(id) => <Textarea id={id} rows={8} {...text("waiver")} />}
          </Field>
        </Section>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
            <span className="text-sm text-ink-muted">You have unsaved changes</span>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Discard
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="grid gap-4 p-5 sm:grid-cols-2">{children}</div>
    </Card>
  );
}
