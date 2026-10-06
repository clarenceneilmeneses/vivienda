import { CalendarClock, FileSignature, ScrollText } from "lucide-react";
import { Field, Input, Spinner, Textarea } from "../../../components/ui";
import { SaveBar, SettingsCard, SettingsHeading, SettingsNote, useSettingsDraft } from "../../../components/admin/SettingsKit";
import { prettyTime } from "../../../lib/format";

/** Settings → Booking rules: when stays start and end, and what guests agree to. */
export default function BookingRules() {
  const f = useSettingsDraft();
  if (f.loading || !f.draft) return <Spinner />;
  const d = f.draft;

  return (
    <div className="max-w-4xl space-y-4">
      <SettingsHeading
        title="Booking rules"
        description="What a guest books into: the times, the downpayment, and the terms they accept at checkout."
      />

      <SettingsCard icon={CalendarClock} title="Stay times & downpayment">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Check-in from" hint={prettyTime(d.check_in_time)}>
            {(id) => <Input id={id} type="time" {...f.text("check_in_time")} />}
          </Field>
          <Field label="Check-out by" hint={prettyTime(d.check_out_time)}>
            {(id) => <Input id={id} type="time" {...f.text("check_out_time")} />}
          </Field>
          <Field label="Downpayment (%)" hint="0 means no downpayment.">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={100}
                value={d.downpayment_percent}
                onChange={(e) => f.set("downpayment_percent", Number(e.target.value))}
              />
            )}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard icon={ScrollText} title="House rules & cancellations" description="Shown on the stay page, at checkout and on each guest's trip.">
        <div className="space-y-4">
          <Field label="House rules" optional>{(id) => <Textarea id={id} rows={6} {...f.text("house_rules")} />}</Field>
          <Field label="Cancellation policy" optional>{(id) => <Textarea id={id} rows={4} {...f.text("cancellation_policy")} />}</Field>
        </div>
      </SettingsCard>

      <SettingsCard icon={FileSignature} title="Guest agreement" description="Guests tick this before they can send a booking request.">
        <Field label="Agreement / waiver" optional hint="Leave blank to use the house rules and cancellation policy above.">
          {(id) => <Textarea id={id} rows={8} {...f.text("waiver")} />}
        </Field>
      </SettingsCard>

      <SettingsNote title="What the database enforces on its own">
        <p>
          The resort can never be double-booked, prices are always calculated on the server, and stays over 60 nights
          have to be arranged with you directly. Those aren't switches.
        </p>
      </SettingsNote>

      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onDiscard={f.discard} />
    </div>
  );
}
