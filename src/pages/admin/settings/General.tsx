import { Building2, Globe, MapPin } from "lucide-react";
import { Field, Input, Spinner, Textarea } from "../../../components/ui";
import { SaveBar, SettingsCard, SettingsHeading, useSettingsDraft } from "../../../components/admin/SettingsKit";

/** Settings → General: who the resort is, as guests and emails see it. */
export default function GeneralSettings() {
  const f = useSettingsDraft();
  if (f.loading) return <Spinner />;

  return (
    <div className="max-w-4xl space-y-4">
      <SettingsHeading title="General" description="The resort's name and contact details, shown on the website, in emails and in guest messages." />

      <SettingsCard icon={Building2} title="The resort" description="Name and the words under it.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resort name">{(id) => <Input id={id} {...f.text("resort_name")} />}</Field>
          <Field label="Tagline" optional>{(id) => <Input id={id} {...f.text("tagline")} />}</Field>
          <Field label="About" optional hint="A short paragraph for the stay page." className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={4} {...f.text("about")} />}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard icon={MapPin} title="Contact & location" description="Guests use these to call you and find you.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact number" optional>{(id) => <Input id={id} {...f.text("phone")} />}</Field>
          <Field label="Contact email" optional>{(id) => <Input id={id} type="email" {...f.text("email")} />}</Field>
          <Field label="Address" optional className="sm:col-span-2">{(id) => <Input id={id} {...f.text("address")} />}</Field>
          <Field label="Google Maps link" optional hint="Used for the Get directions buttons." className="sm:col-span-2">
            {(id) => <Input id={id} {...f.text("map_url")} placeholder="https://maps.app.goo.gl/…" />}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard icon={Globe} title="Social" description="Linked from the footer and the reviews section.">
        <Field label="Facebook page" optional>
          {(id) => <Input id={id} {...f.text("facebook_url")} placeholder="https://facebook.com/yourresort" />}
        </Field>
      </SettingsCard>

      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onDiscard={f.discard} />
    </div>
  );
}
