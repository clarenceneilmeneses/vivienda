import { Eye, Landmark, Smartphone } from "lucide-react";
import { Field, Input, Spinner, Textarea } from "../../../components/ui";
import { SaveBar, SettingsCard, SettingsHeading, useSettingsDraft } from "../../../components/admin/SettingsKit";

/** Settings → Payments: where guests send money, and a preview of what they see. */
export default function PaymentSettings() {
  const f = useSettingsDraft();
  if (f.loading || !f.draft) return <Spinner />;
  const d = f.draft;

  return (
    <div className="space-y-4">
      <SettingsHeading
        title="Payments"
        description="The accounts guests pay into. They see these at checkout, on their trip page and in the booking emails. A method with no account number is hidden."
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SettingsCard icon={Smartphone} title="GCash">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GCash number" optional>{(id) => <Input id={id} {...f.text("gcash_number")} placeholder="0917 123 4567" />}</Field>
              <Field label="Account name" optional>{(id) => <Input id={id} {...f.text("gcash_name")} />}</Field>
            </div>
          </SettingsCard>
          <SettingsCard icon={Landmark} title="Bank transfer">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank" optional>{(id) => <Input id={id} {...f.text("bank_name")} placeholder="e.g. BDO" />}</Field>
              <Field label="Account name" optional>{(id) => <Input id={id} {...f.text("bank_account_name")} />}</Field>
              <Field label="Account number" optional className="sm:col-span-2">
                {(id) => <Input id={id} {...f.text("bank_account_number")} />}
              </Field>
            </div>
          </SettingsCard>
          <SettingsCard icon={Landmark} title="Instructions" description="One or two lines under the payment details.">
            <Textarea rows={3} {...f.text("payment_instructions")} aria-label="Payment instructions" />
          </SettingsCard>
        </div>

        <SettingsCard icon={Eye} title="What guests see" className="h-fit xl:sticky xl:top-0">
          <div className="rounded-xl bg-sand-100 p-4 text-sm">
            <p className="font-semibold text-ink">Send your {d.downpayment_percent}% downpayment</p>
            <dl className="mt-3 divide-y divide-sand-200 rounded-lg bg-white">
              {d.gcash_number && (
                <Row k="GCash" v={d.gcash_number} sub={d.gcash_name} />
              )}
              {d.bank_account_number && <Row k={d.bank_name || "Bank"} v={d.bank_account_number} sub={d.bank_account_name} />}
              {!d.gcash_number && !d.bank_account_number && (
                <p className="px-3 py-2.5 text-ink-muted">No accounts yet. Guests can only choose “Pay later”.</p>
              )}
            </dl>
            {d.payment_instructions && <p className="mt-3 text-ink-soft">{d.payment_instructions}</p>}
          </div>
        </SettingsCard>
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onDiscard={f.discard} />
    </div>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2.5">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">
        {v}
        {sub && <span className="block text-xs font-normal text-ink-muted">{sub}</span>}
      </dd>
    </div>
  );
}
