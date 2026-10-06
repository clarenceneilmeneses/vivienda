import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { History, Inbox, Mail, UserRound } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { cn } from "../../../lib/utils";
import { Badge, Field, Input, Spinner, Switch } from "../../../components/ui";
import { SaveBar, SettingsCard, SettingsHeading, SettingsNote, useSettingsDraft } from "../../../components/admin/SettingsKit";

interface EmailEvent {
  type: string;
  title: string;
  when: string;
}

const TO_GUEST: EmailEvent[] = [
  { type: "booking_received", title: "Booking received", when: "Right after a guest sends a request on the website." },
  { type: "booking_confirmed", title: "Booking confirmed", when: "When you confirm a request (you can untick it each time)." },
  { type: "booking_declined", title: "Booking declined", when: "When you decline a request." },
  { type: "booking_cancelled", title: "Booking cancelled", when: "When you cancel a confirmed booking." },
  { type: "payment_received", title: "Payment receipt", when: "When you record a payment and choose to email it." },
  { type: "reminder", title: "Arrival reminder", when: "Automatically, a few days before check-in (see below)." },
  { type: "message_to_guest", title: "New message from you", when: "When you reply in the Inbox and the guest hasn't read it yet." },
];
const TO_YOU: EmailEvent[] = [
  { type: "new_booking_admin", title: "New booking request", when: "Every time a guest books on the website." },
  { type: "message_to_host", title: "New guest message", when: "When a guest messages you. At most one every 10 minutes per guest." },
];

/** Settings → Notifications: every email the system sends, with a switch on each. */
export default function NotificationSettings() {
  const f = useSettingsDraft();
  const { data: log } = useQuery({
    queryKey: ["email_log", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_log")
        .select("id, type, to_email, status, error, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (f.loading || !f.draft) return <Spinner />;
  const d = f.draft;
  const off = new Set(d.disabled_emails ?? []);
  const toggle = (type: string, on: boolean) => {
    const next = new Set(off);
    if (on) next.delete(type);
    else next.add(type);
    f.set("disabled_emails", [...next]);
  };

  const list = (events: EmailEvent[], muted = false) => (
    <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200">
      {events.map((e) => (
        <li key={e.type} className={cn("px-4 py-3", muted && "opacity-50")}>
          <Switch checked={!off.has(e.type)} onChange={(v) => toggle(e.type, v)} label={e.title} description={e.when} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="max-w-4xl space-y-4">
      <SettingsHeading title="Notifications" description="Every email the system sends, who gets it, and a switch on each." />

      <SettingsCard icon={UserRound} title="To guests">
        <div className="mb-4 rounded-xl bg-sand-100 p-3.5">
          <Switch
            checked={d.send_emails}
            onChange={(v) => f.set("send_emails", v)}
            label="Email guests at all"
            description="The master switch. Off, no guest gets any email; everything still shows on their Trips page."
          />
        </div>
        {list(TO_GUEST, !d.send_emails)}
        <Field label="Arrival reminder" hint="Days before check-in. 0 turns reminders off." className="mt-4 max-w-48">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={14}
              value={d.reminder_days_before}
              onChange={(e) => f.set("reminder_days_before", Number(e.target.value))}
            />
          )}
        </Field>
      </SettingsCard>

      <SettingsCard icon={Inbox} title="To you" description="Where you hear about new bookings and messages.">
        <Field
          label="Send to"
          hint={`Leave blank to use the contact email (${d.email || "not set"}).`}
          className="mb-4 max-w-md"
        >
          {(id) => <Input id={id} type="email" {...f.text("admin_notify_email")} placeholder="you@example.com" />}
        </Field>
        {list(TO_YOU)}
      </SettingsCard>

      <SettingsCard icon={History} title="Recently sent" description="The last emails the system tried to send.">
        {!log ? (
          <Spinner />
        ) : log.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-sand-200 text-sm">
            {log.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Mail className="size-3.5 shrink-0 text-ink-muted" />
                  <span className="truncate text-ink">{r.type.replaceAll("_", " ")}</span>
                  <span className="truncate text-xs text-ink-muted">→ {r.to_email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      r.status === "sent" && "bg-emerald-50 text-emerald-800",
                      r.status === "failed" && "bg-red-50 text-red-700",
                    )}
                  >
                    {r.status}
                  </Badge>
                  <span className="text-xs text-ink-muted">{format(parseISO(r.created_at), "MMM d, h:mm a")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      <SettingsNote title="How mail leaves">
        <p>
          Emails go out through Resend from the address in the <code>EMAIL_FROM</code> setting on Vercel. Until{" "}
          <code>RESEND_API_KEY</code> is set, every email is logged as “skipped” and nothing is lost.
        </p>
      </SettingsNote>

      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onDiscard={f.discard} />
    </div>
  );
}
