import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import type { BookingStatus, Conversation, Message, PaymentMethod } from "./types";

/**
 * The guest side of the site: the signed-in guest's profile, trips, the one
 * conversation with the resort, and reviews. Every read goes through a
 * database function that only returns the caller's own rows.
 */

export interface GuestProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface Trip {
  id: string;
  ref: string;
  status: BookingStatus;
  unit_name: string;
  unit_slug: string;
  unit_photo: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  guests_count: number;
  total: number;
  paid: number;
  balance: number;
  payment_method: PaymentMethod | null;
  has_receipt: boolean;
  special_requests: string;
  created_at: string;
  review_rating: number | null;
  review_body: string | null;
  review_status: "pending" | "published" | "hidden" | null;
  review_reply: string | null;
}

export interface PublishedReview {
  id: string;
  guest_name: string;
  rating: number;
  body: string;
  host_reply: string;
  stayed_on: string;
  created_at: string;
}

/** Signed in, and not the owner. The admin account never becomes a guest. */
export function useIsGuest() {
  const { session, isAdmin, loading } = useAuth();
  return { signedIn: Boolean(session), isGuest: Boolean(session) && !isAdmin && !loading, loading };
}

/**
 * The guest record behind the account. A new account gets one on first load,
 * from the name and number given at sign-up.
 */
export function useGuestProfile() {
  const { session } = useAuth();
  const { isGuest } = useIsGuest();
  return useQuery({
    queryKey: ["guest", "profile", session?.user.id],
    enabled: isGuest,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GuestProfile | null> => {
      const read = async () => {
        const { data, error } = await supabase.rpc("my_profile");
        if (error) throw error;
        return ((data ?? []) as GuestProfile[])[0] ?? null;
      };
      const found = await read();
      if (found) return found;
      const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; phone?: string };
      const { error } = await supabase.rpc("guest_save_profile", {
        p_full_name: meta.full_name ?? "",
        p_phone: meta.phone ?? "",
      });
      if (error) throw error;
      return read();
    },
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { fullName: string; phone: string }) => {
      const { error } = await supabase.rpc("guest_save_profile", { p_full_name: v.fullName, p_phone: v.phone });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: v.fullName, phone: v.phone } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest"] }),
  });
}

export function useMyTrips() {
  const profile = useGuestProfile();
  const query = useQuery({
    queryKey: ["guest", "trips", profile.data?.id],
    enabled: Boolean(profile.data),
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase.rpc("my_bookings");
      if (error) throw error;
      return ((data ?? []) as Trip[]).map((t) => ({
        ...t,
        total: Number(t.total),
        paid: Number(t.paid),
        balance: Number(t.balance),
      }));
    },
  });
  return { ...query, isLoading: profile.isLoading || query.isLoading, profileError: profile.error };
}

export function useTripPayments(bookingId: string | undefined) {
  return useQuery({
    queryKey: ["guest", "payments", bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_payments", { p_booking: bookingId });
      if (error) throw error;
      return ((data ?? []) as { kind: "payment" | "refund"; amount: number; method: PaymentMethod; paid_on: string }[]).map(
        (p) => ({ ...p, amount: Number(p.amount) }),
      );
    },
  });
}

/** Upcoming first (soonest at the top), then everything that is over. */
export function splitTrips(trips: Trip[], today: string) {
  const upcoming = trips
    .filter((t) => ["pending", "confirmed", "checked_in"].includes(t.status) && t.check_out >= today)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));
  const past = trips.filter((t) => !upcoming.includes(t) && !["cancelled", "declined"].includes(t.status));
  const cancelled = trips.filter((t) => ["cancelled", "declined"].includes(t.status));
  return { upcoming, past, cancelled };
}

// ───────────────────────── messages ─────────────────────────

export function normalizeMessage(m: Record<string, unknown>): Message {
  return m as unknown as Message;
}

/** The guest's conversation and every message in it. */
export function useGuestThread(opts: { enabled?: boolean } = {}) {
  const profile = useGuestProfile();
  return useQuery({
    queryKey: ["guest", "thread", profile.data?.id],
    enabled: Boolean(profile.data) && (opts.enabled ?? true),
    refetchInterval: 30_000,
    queryFn: async (): Promise<{ conversation: Conversation | null; messages: Message[] }> => {
      const { data: c, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("guest_id", profile.data!.id)
        .maybeSingle();
      if (error) throw error;
      if (!c) return { conversation: null, messages: [] };
      const { data: m, error: e2 } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", c.id)
        .order("sent_at");
      if (e2) throw e2;
      return { conversation: c as Conversation, messages: (m ?? []).map(normalizeMessage) };
    },
  });
}

/** Replies from the resort the guest has not opened yet. */
export function useGuestUnread() {
  const profile = useGuestProfile();
  return useQuery({
    queryKey: ["guest", "unread", profile.data?.id],
    enabled: Boolean(profile.data),
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { data: c } = await supabase
        .from("conversations")
        .select("id, guest_seen_at")
        .eq("guest_id", profile.data!.id)
        .maybeSingle();
      if (!c) return 0;
      let q = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .eq("author", "host")
        .is("unsent_at", null);
      if (c.guest_seen_at) q = q.gt("sent_at", c.guest_seen_at);
      const { count } = await q;
      return count ?? 0;
    },
  });
}

export interface Inquiry {
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
}

export function useSendGuestMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { body: string; kind?: "message" | "problem"; inquiry?: Inquiry | null }) => {
      const { error } = await supabase.rpc("guest_send_message", {
        p_body: v.body,
        p_kind: v.kind ?? "message",
        p_check_in: v.inquiry?.checkIn ?? null,
        p_check_out: v.inquiry?.checkOut ?? null,
        p_guests: v.inquiry?.guests ?? null,
      });
      if (error) throw error;
      void notifyMessage("to_host");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest", "thread"] }),
  });
}

export function useGuestMarkSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("guest_mark_seen");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest", "unread"] }),
  });
}

/**
 * Asks the server to email the other side about a new message. The server
 * decides who, and stays quiet if it already emailed about this conversation
 * in the last few minutes, so a burst of messages is one email.
 */
export async function notifyMessage(direction: "to_host" | "to_guest", conversationId?: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/message-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ direction, conversationId }),
    });
  } catch {
    /* the message is saved either way */
  }
}

/**
 * Keeps the given queries fresh while a table changes. Realtime respects row
 * level security, so a guest only hears about their own conversation.
 */
export function useLiveTables(name: string, tables: string[], keys: QueryKey[], enabled = true) {
  const qc = useQueryClient();
  const tableKey = tables.join(",");
  const keyKey = JSON.stringify(keys);
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(`${name}-${Math.random().toString(36).slice(2)}`);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const key of JSON.parse(keyKey) as QueryKey[]) void qc.invalidateQueries({ queryKey: key });
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [name, tableKey, keyKey, enabled, qc]);
}

// ───────────────────────── trips ─────────────────────────

export function useCancelTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc("guest_cancel_booking", { p_booking: bookingId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest"] }),
  });
}

export function useAttachReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { bookingId: string; file: File; method: PaymentMethod | null }) => {
      const ext = v.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("receipts").upload(path, v.file, { contentType: v.file.type || undefined });
      if (up.error) throw new Error(`Couldn't upload the receipt: ${up.error.message}`);
      const { error } = await supabase.rpc("guest_attach_receipt", {
        p_booking: v.bookingId,
        p_path: path,
        p_method: v.method,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest"] }),
  });
}

export function useSaveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { bookingId: string; rating: number; body: string }) => {
      const { error } = await supabase.rpc("guest_save_review", {
        p_booking: v.bookingId,
        p_rating: v.rating,
        p_body: v.body,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest", "trips"] }),
  });
}

export function usePublishedReviews() {
  return useQuery({
    queryKey: ["reviews", "published"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PublishedReview[]> => {
      const { data, error } = await supabase.rpc("published_reviews");
      // Before the guest-side SQL has been run, the site simply shows no guest reviews.
      if (error) return [];
      return (data ?? []) as PublishedReview[];
    },
  });
}
