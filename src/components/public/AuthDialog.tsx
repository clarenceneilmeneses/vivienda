import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Eye, EyeOff, MailCheck, X } from "lucide-react";
import { errorMessage, supabase } from "../../lib/supabase";
import { PHOTOS } from "../../lib/site";
import { cn } from "../../lib/utils";
import { Button, ErrorBox, Field, Input } from "../ui";

export type AuthMode = "signin" | "signup" | "forgot";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * The guest's door: sign in, create an account, or reset a password. Laid out
 * like Malaya's: a photo of the place on the left, the form on the right. On a
 * phone it is a sheet from the bottom and the photo steps aside.
 */
export function AuthDialog({
  open,
  mode,
  onMode,
  onClose,
}: {
  open: boolean;
  mode: AuthMode;
  onMode: (m: AuthMode) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSent(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => setError(null), [mode]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return setError("Enter a valid email address.");
    if (mode !== "forgot" && password.length < 8) return setError("Passwords are at least 8 characters.");
    if (mode === "signup" && !name.trim()) return setError("Enter your full name.");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (error) {
          throw new Error(
            /invalid login/i.test(error.message)
              ? "That email and password don't match. Try again or reset your password."
              : /not confirmed/i.test(error.message)
                ? "Confirm your email first. Check your inbox for the link we sent."
                : error.message,
          );
        }
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password,
          options: {
            data: { full_name: name.trim(), phone: phone.trim() },
            emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          },
        });
        if (error) throw error;
        if (!data.session) setSent("confirm");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(em, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("reset");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const heading =
    sent === "confirm"
      ? "Check your email"
      : sent === "reset"
        ? "Check your email"
        : mode === "signup"
          ? "Create your account"
          : mode === "forgot"
            ? "Reset your password"
            : "Welcome back";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" data-site="public">
      <div className="absolute inset-0 bg-espresso/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="relative grid max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-level-4 sm:rounded-3xl md:grid-cols-[0.85fr_1fr]"
      >
        <aside className="relative hidden overflow-hidden md:block">
          <img src={PHOTOS.poolWaterfall.src} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-espresso/90 via-espresso/35 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-8 text-white">
            <img src="/images/logo-192.png" alt="" className="size-12 rounded-full ring-2 ring-white/40" />
            <p className="site-display mt-5 text-2xl leading-tight">Your private haven, one tap away.</p>
            <p className="mt-3 max-w-[28ch] text-sm leading-relaxed text-white/80">
              Your trips, payments and messages with us, all in one place.
            </p>
          </div>
        </aside>

        <div className="relative px-6 pt-10 pb-8 sm:px-9">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 grid size-9 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <img src="/images/logo-192.png" alt="" className="mx-auto mb-5 size-12 rounded-full md:hidden" />

          {sent ? (
            <div className="py-6 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-700/10 text-brand-700">
                <MailCheck className="size-7" />
              </span>
              <h2 className="site-display mt-5 text-2xl text-brand-700">{heading}</h2>
              <p className="mx-auto mt-3 max-w-[34ch] text-sm text-ink-soft">
                {sent === "confirm" ? (
                  <>
                    We sent a link to <span className="font-medium text-ink">{email}</span>. Open it to finish creating
                    your account. Your past bookings with this email will appear once you do.
                  </>
                ) : (
                  <>
                    If <span className="font-medium text-ink">{email}</span> has an account, a link to set a new password
                    is on its way.
                  </>
                )}
              </p>
              <Button variant="secondary" className="mt-6" onClick={() => (setSent(null), onMode("signin"))}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => onMode("signin")}
                  className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
                >
                  <ArrowLeft className="size-4" /> Back
                </button>
              )}
              <p className="eyebrow text-center text-brand-700!">Vivienda</p>
              <h2 className="site-display mt-2 text-center text-3xl leading-none text-brand-700">{heading}</h2>
              <p className="mx-auto mt-3 max-w-[34ch] text-center text-sm text-ink-muted">
                {mode === "signup"
                  ? "Book faster, keep track of your trips and message us anytime."
                  : mode === "forgot"
                    ? "Enter your email and we'll send you a link."
                    : "Sign in to see your trips and messages."}
              </p>

              {mode !== "forgot" && (
                <div className="mt-6 grid grid-cols-2 rounded-full bg-sand-100 p-1 text-sm font-medium" role="tablist">
                  {(["signin", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => onMode(m)}
                      className={cn(
                        "h-9 cursor-pointer rounded-full transition-colors",
                        mode === m ? "bg-white text-ink shadow-level-1" : "text-ink-muted hover:text-ink",
                      )}
                    >
                      {m === "signin" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={submit} noValidate className="mt-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <Field label="Full name">
                      {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
                    </Field>
                    <Field label="Mobile number" optional>
                      {(id) => (
                        <Input
                          id={id}
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          autoComplete="tel"
                          placeholder="0917 123 4567"
                        />
                      )}
                    </Field>
                  </>
                )}
                <Field label="Email">
                  {(id) => (
                    <Input
                      id={id}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                    />
                  )}
                </Field>
                {mode !== "forgot" && (
                  <Field
                    label="Password"
                    hint={mode === "signup" ? "At least 8 characters." : undefined}
                  >
                    {(id) => (
                      <div className="relative">
                        <Input
                          id={id}
                          type={show ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShow((v) => !v)}
                          className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center text-ink-muted hover:text-ink"
                          aria-label={show ? "Hide password" : "Show password"}
                        >
                          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    )}
                  </Field>
                )}
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => onMode("forgot")}
                    className="-mt-1 cursor-pointer text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
                  >
                    Forgot password?
                  </button>
                )}
                <ErrorBox>{error}</ErrorBox>
                <Button type="submit" size="lg" loading={busy} className="w-full rounded-full">
                  {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
                </Button>
                {mode === "signup" && (
                  <p className="text-center text-xs text-ink-muted">
                    Booked with us before? Use the same email and your bookings will show up.
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
