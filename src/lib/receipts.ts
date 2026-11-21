import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

/**
 * Receipts live in the private 'receipts' bucket: guests' payment proofs at the
 * top level (from the booking flow), the owner's under expenses/ and payments/.
 * Only an admin can read them, through short-lived signed links.
 */
export const RECEIPT_BUCKET = "receipts";
export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadReceipt(file: File, folder: "expenses" | "payments"): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 10 MB.`);
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeReceipt(path: string | null | undefined) {
  if (path) await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
}

export function isPdf(path: string) {
  return path.toLowerCase().endsWith(".pdf");
}

/** A signed link to a receipt, good for an hour. */
export function useReceiptUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["receipt", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Opens a receipt in a new tab. */
export async function openReceipt(path: string) {
  const w = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) {
    w?.close();
    throw new Error(error?.message ?? "Couldn't open the receipt.");
  }
  if (w) w.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

/** Said when the receipt columns aren't in the database yet. */
export function receiptColumnMissing(message: string) {
  return /receipt_path/.test(message)
    ? "Receipts need the latest supabase/schema.sql. Run it in Supabase (SQL editor), then try again."
    : message;
}
