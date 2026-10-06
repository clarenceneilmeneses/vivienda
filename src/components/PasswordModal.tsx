import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { errorMessage, supabase } from "../lib/supabase";
import { Button, ErrorBox, Field, Input, Modal } from "./ui";

export function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setPw(""), setPw2(""), setError(null);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast.success("Password updated");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          {(id) => <Input id={id} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />}
        </Field>
        <Field label="Repeat it">
          {(id) => <Input id={id} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />}
        </Field>
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" loading={busy} className="w-full">
          Update password
        </Button>
      </form>
    </Modal>
  );
}
