import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
}

export const supabase = createClient(url, key);

export function photoUrl(path: string) {
  // Full URLs and files shipped with the site (/images/…) are used as they are.
  if (/^https?:\/\//.test(path) || path.startsWith("/")) return path;
  return supabase.storage.from("unit-photos").getPublicUrl(path).data.publicUrl;
}

/** Turns a Supabase/Postgres error into a sentence a person can read. */
export function errorMessage(err: unknown): string {
  if (!err) return "Something went wrong.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && "message" in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg.includes("bookings_no_overlap")) return "Those dates overlap another booking for this unit.";
    if (msg.includes("Failed to fetch")) return "Can't reach the server. Check your connection and try again.";
    return msg;
  }
  return "Something went wrong.";
}
