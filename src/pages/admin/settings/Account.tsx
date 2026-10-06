import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";
import { Button } from "../../../components/ui";
import { SettingsCard, SettingsHeading, SettingsNote } from "../../../components/admin/SettingsKit";
import { PasswordModal } from "../../../components/PasswordModal";

/** Settings → Account & access: your login, and who else can open the admin. */
export default function AccountSettings() {
  const { session, signOut } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const { data: admins = [] } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admins").select("email").order("email");
      if (error) throw error;
      return (data ?? []).map((r) => r.email as string);
    },
  });
  const email = session?.user.email ?? "";

  return (
    <div className="max-w-3xl space-y-4">
      <SettingsHeading title="Account & access" description="Your login, and who else can open this admin." />

      <SettingsCard icon={UserRound} title="Your login">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-brand-700 font-semibold text-sand-50">
              {email.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-medium text-ink">{email}</p>
              <p className="text-xs text-ink-muted">Owner · full access</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPwOpen(true)}>
              <KeyRound className="size-4" /> Change password
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={ShieldCheck} title="Admins" description="Anyone signed in with one of these emails can see and change everything here.">
        <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200">
          {admins.map((a) => (
            <li key={a} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-ink">{a}</span>
              {a.toLowerCase() === email.toLowerCase() && <span className="text-xs text-ink-muted">You</span>}
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsNote title="Adding a staff member">
        <p>
          Create their login in Supabase (Authentication → Users → Add user), then add their email to the{" "}
          <code>admins</code> table. Guest accounts made on the website can never open the admin.
        </p>
      </SettingsNote>

      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
