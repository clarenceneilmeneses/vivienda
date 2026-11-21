import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { isPdf, openReceipt, RECEIPT_ACCEPT, uploadReceipt, useReceiptUrl } from "../../lib/receipts";
import { cn } from "../../lib/utils";

/**
 * Attach a receipt to an expense or a payment: a photo or a PDF. Uploads on
 * pick, so saving the form only stores the path. `value` is the stored path.
 */
export function ReceiptField({
  value,
  onChange,
  folder,
  onBusy,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  folder: "expenses" | "payments";
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { data: url } = useReceiptUrl(value && !isPdf(value) ? value : null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    onBusy?.(true);
    try {
      onChange(await uploadReceipt(file, folder));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-sand-300 bg-white p-2">
        <button
          type="button"
          onClick={() => openReceipt(value).catch((e) => toast.error((e as Error).message))}
          className="grid size-14 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg bg-sand-100 text-ink-muted"
          title="Open the receipt"
        >
          {url ? <img src={url} alt="Receipt" className="size-full object-cover" /> : <FileText className="size-6" />}
        </button>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-ink">Receipt attached</p>
          <button
            type="button"
            onClick={() => openReceipt(value).catch((e) => toast.error((e as Error).message))}
            className="cursor-pointer text-xs text-brand-700 hover:underline"
          >
            Open {isPdf(value) ? "PDF" : "photo"}
          </button>
        </div>
        <label className="cursor-pointer rounded-lg px-2 py-1 text-xs text-ink-muted hover:bg-sand-100 hover:text-ink">
          Replace
          <input type="file" accept={RECEIPT_ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="cursor-pointer rounded-md p-1 text-ink-muted hover:bg-red-50 hover:text-red-700"
          aria-label="Remove receipt"
          title="Remove receipt"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sand-300 px-3 py-4 text-sm text-ink-muted hover:border-brand-500 hover:text-ink",
        busy && "pointer-events-none opacity-70",
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
      {busy ? "Uploading…" : "Attach a photo or PDF"}
      <input type="file" accept={RECEIPT_ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
    </label>
  );
}
