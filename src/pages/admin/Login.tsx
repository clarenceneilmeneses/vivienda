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
    <div className="flex min-h-screen items-center justify-center bg-forest-700 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="font-display text-2xl font-semibold text-forest-700">{settings?.resort_name ?? "Vivienda"}</h1>
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
          <Link to="/" className="text-ink-muted hover:underline">
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  );
}
