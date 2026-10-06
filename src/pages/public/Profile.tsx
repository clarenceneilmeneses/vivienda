import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarCheck, ChevronRight, KeyRound, LogOut, MessageCircle, Search } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useGuestProfile, useGuestUnread, useMyTrips, useSaveProfile } from "../../lib/guest";
import { prettyDate } from "../../lib/format";
import { errorMessage } from "../../lib/supabase";
import { Button, ErrorBox, Field, Input, Spinner } from "../../components/ui";
import { PasswordModal } from "../../components/PasswordModal";
import { GuestOnly } from "./Trips";

export default function Profile() {
  return (
    <GuestOnly title="Profile">
      <ProfileBody />
    </GuestOnly>
  );
}

function ProfileBody() {
  const { signOut } = useAuth();
  const { data: profile, isLoading, error } = useGuestProfile();
  const { data: trips = [] } = useMyTrips();
  const { data: unread = 0 } = useGuestUnread();
  const save = useSaveProfile();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.full_name);
    setPhone(profile.phone ?? "");
  }, [profile]);

  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  if (error || !profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorBox>{errorMessage(error) || "We couldn't load your profile."}</ErrorBox>
      </div>
    );
  }

  const stays = trips.filter((t) => t.status === "checked_out").length;
  const dirty = name.trim() !== profile.full_name || phone.trim() !== (profile.phone ?? "");

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-28 sm:px-8 sm:pt-12">
      <h1 className="site-display text-3xl text-brand-700 sm:text-4xl">Profile.</h1>

      <div className="mt-6 flex items-center gap-5 rounded-3xl border border-sand-200 p-6 shadow-level-2">
        <span className="grid size-20 shrink-0 place-items-center rounded-full bg-brand-700 font-display text-3xl text-sand-50">
          {profile.full_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-2xl text-ink">{profile.full_name}</p>
          <p className="truncate text-sm text-ink-muted">{profile.email}</p>
          <p className="mt-1 text-xs text-ink-muted">
            Guest since {prettyDate(profile.created_at.slice(0, 10), "MMMM yyyy")} · {stays} stay{stays === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <nav className="mt-6 divide-y divide-sand-200 rounded-3xl border border-sand-200">
        <MenuLink to="/trips" icon={<CalendarCheck />} label="Trips" note={`${trips.length} booking${trips.length === 1 ? "" : "s"}`} />
        <MenuLink to="/messages" icon={<MessageCircle />} label="Messages" note={unread ? `${unread} unread` : undefined} />
        <MenuLink to="/my-booking" icon={<Search />} label="Find a booking by reference" />
      </nav>

      <form
        className="mt-8 rounded-3xl border border-sand-200 p-6"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate(
            { fullName: name.trim(), phone: phone.trim() },
            { onSuccess: () => toast.success("Profile saved"), onError: (err) => toast.error(errorMessage(err)) },
          );
        }}
      >
        <h2 className="font-display text-lg text-ink">Personal info</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
          </Field>
          <Field label="Mobile number">
            {(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />}
          </Field>
          <Field label="Email" hint="Your bookings are matched to this email." className="sm:col-span-2">
            {(id) => <Input id={id} value={profile.email} disabled />}
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => setPwOpen(true)}>
            <KeyRound className="size-4" /> Change password
          </Button>
          <Button type="submit" disabled={!dirty || !name.trim()} loading={save.isPending}>
            Save
          </Button>
        </div>
      </form>

      <Button variant="secondary" className="mt-6 w-full" onClick={() => void signOut()}>
        <LogOut className="size-4" /> Sign out
      </Button>

      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

function MenuLink({ to, icon, label, note }: { to: string; icon: React.ReactNode; label: string; note?: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 px-5 py-4 transition-colors first:rounded-t-3xl last:rounded-b-3xl hover:bg-sand-50">
      <span className="text-brand-700 [&_svg]:size-5">{icon}</span>
      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
      {note && <span className="text-xs text-ink-muted">{note}</span>}
      <ChevronRight className="size-4 text-ink-muted" />
    </Link>
  );
}

