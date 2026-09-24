import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { errorMessage, supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useSettings } from "../../lib/queries";
import { Button, ErrorBox, Field, Input } from "../../components/ui";

export default function Login() {
  const { session, loading } = useAuth();
  const { data: settings } = useSettings();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/admin";
  if (!loading && session) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Wrong email or password." : errorMessage(error));
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      {/* The brand half: the property, under the espresso. */}
      <div className="relative hidden overflow-hidden bg-espresso lg:block">
        <img src="/images/pool-aframe.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-linear-to-t from-espresso via-espresso/50 to-espresso/20" />
        <div className="relative flex h-full flex-col justify-between p-12 text-cream">
          <img src="/images/logo-192.png" alt="" className="size-16 rounded-full ring-1 ring-cream/20" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.28em] text-cream/70 uppercase">Resort admin</p>
            <p className="mt-3 font-display text-4xl leading-tight tracking-[0.12em]">VIVIENDA</p>
            <p className="mt-2 max-w-sm text-cream/75">Bookings, calendar, guests and money, in one place.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-sand-100 p-4 lg:bg-white">
        <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-level-3 lg:shadow-none">
          <img src="/images/logo-192.png" alt="" className="mb-5 size-14 rounded-full lg:hidden" />
          <p className="eyebrow">{settings?.resort_name ?? "Vivienda"}</p>
          <h1 className="mt-1 font-display text-[28px] font-medium text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to manage bookings.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email">
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            )}
          </Field>
          <Field label="Password">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
          </Field>
          <ErrorBox>{error}</ErrorBox>
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>
          <p className="mt-6 text-center text-xs">
            <Link to="/" className="text-ink-muted hover:text-brand-700 hover:underline">
              ← Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
