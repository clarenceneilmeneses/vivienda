import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { errorMessage, supabase } from "../../lib/supabase";
import { Button, ErrorBox, Field, Input, Spinner } from "../../components/ui";

/** Where the "reset your password" email lands. The link signs the guest in. */
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast.success("Password updated. You're signed in.");
    navigate("/trips");
  }

  if (loading) return <Spinner className="min-h-[50vh]" />;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-700/10 text-brand-700">
        <KeyRound className="size-6" />
      </span>
      <h1 className="site-display mt-5 text-center text-3xl text-brand-700">New password.</h1>
      {!session ? (
        <p className="mt-4 text-center text-ink-muted">
          This link has expired or was already used. Open Sign in and choose "Forgot password?" to get a new one.{" "}
          <Link to="/" className="font-medium text-ink underline">
            Back to home
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="New password" hint="At least 8 characters.">
            {(id) => <Input id={id} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />}
          </Field>
          <Field label="Repeat it">
            {(id) => <Input id={id} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />}
          </Field>
          <ErrorBox>{error}</ErrorBox>
          <Button type="submit" size="lg" loading={busy} className="w-full rounded-full">
            Save password
          </Button>
        </form>
      )}
    </div>
  );
}
