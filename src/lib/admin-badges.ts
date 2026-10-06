import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

/** Conversations waiting on a reply. Used by the sidebar badge and the dashboard. */
export function useInboxUnread(enabled = true) {
  return useQuery({
    queryKey: ["inbox", "unread-count"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("admin_unread", true)
        .is("archived_at", null);
      // Before the messaging SQL has been run there is simply nothing to count.
      if (error) return 0;
      return count ?? 0;
    },
  });
}

/** Reviews waiting to be published. Used by the sidebar badge. */
export function usePendingReviews(enabled = true) {
  return useQuery({
    queryKey: ["reviews", "pending-count"],
    enabled,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
  });
}
