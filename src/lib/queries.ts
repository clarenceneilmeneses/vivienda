import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { SITE } from "./site";
import type { BookingSummary, Settings, Unit } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  resort_name: SITE.name,
  tagline: SITE.tagline,
  about: SITE.about,
  email: SITE.email,
  phone: SITE.phone,
  address: SITE.address,
  facebook_url: SITE.facebook,
  map_url: SITE.mapUrl,
  check_in_time: "14:00",
  check_out_time: "12:00",
  downpayment_percent: 50,
  gcash_name: "",
  gcash_number: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  payment_instructions: "",
  house_rules: "",
  cancellation_policy: "",
  waiver: "",
  send_emails: true,
  admin_notify_email: "",
  reminder_days_before: 2,
};

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      // Blank text in the database falls back to the default, so the site
      // shows Vivienda's contact details until the owner changes them.
      const filled = Object.fromEntries(
        Object.entries(data ?? {}).filter(([, v]) => v !== null && v !== ""),
      );
      return { ...DEFAULT_SETTINGS, ...filled } as Settings;
    },
    staleTime: 5 * 60_000,
  });
}

/** Active units for guests; every unit for the admin (RLS decides). */
export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: async (): Promise<Unit[]> => {
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []).map(normalizeUnit);
    },
  });
}

export function normalizeUnit(u: Record<string, unknown>): Unit {
  return {
    ...(u as unknown as Unit),
    base_rate: Number(u.base_rate ?? 0),
    weekend_rate: u.weekend_rate == null ? null : Number(u.weekend_rate),
    extra_guest_fee: Number(u.extra_guest_fee ?? 0),
    amenities: (u.amenities as string[]) ?? [],
    photos: (u.photos as string[]) ?? [],
  };
}

export function normalizeBooking(b: Record<string, unknown>): BookingSummary {
  return {
    ...(b as unknown as BookingSummary),
    subtotal: Number(b.subtotal ?? 0),
    discount: Number(b.discount ?? 0),
    total: Number(b.total ?? 0),
    paid: Number(b.paid ?? 0),
    balance: Number(b.balance ?? 0),
  };
}

/** Nights a unit can't be booked, from the public function (no guest data). */
export function useUnavailableNights(unitId: string | null | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["unavailable", unitId, from, to],
    enabled: Boolean(unitId),
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.rpc("unavailable_nights", { p_unit: unitId, p_from: from, p_to: to });
      if (error) throw error;
      return new Set(((data ?? []) as string[]).map((d) => String(d).slice(0, 10)));
    },
  });
}

export function useRateOverrides(unitId: string | null | undefined) {
  return useQuery({
    queryKey: ["rate_overrides", unitId],
    enabled: Boolean(unitId),
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.from("rate_overrides").select("date, rate").eq("unit_id", unitId!);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.date as string, Number(r.rate)]));
    },
  });
}

/** The nightly rate the database would charge. Mirrors public.quote_stay. */
export function nightlyRate(unit: Unit, iso: string, overrides?: Map<string, number>) {
  const o = overrides?.get(iso);
  if (o != null) return o;
  const dow = new Date(`${iso}T00:00:00`).getDay(); // 5 = Fri, 6 = Sat
  if ((dow === 5 || dow === 6) && unit.weekend_rate != null) return unit.weekend_rate;
  return unit.base_rate;
}

/** Bookings that touch [from, to] (dates as YYYY-MM-DD), from the summary view. */
export function useBookingsInRange(from: string, to: string) {
  return useQuery({
    queryKey: ["bookings", "range", from, to],
    queryFn: async (): Promise<BookingSummary[]> => {
      const { data, error } = await supabase
        .from("booking_summary")
        .select("*")
        .lte("check_in", to)
        .gt("check_out", from)
        .order("check_in");
      if (error) throw error;
      return (data ?? []).map(normalizeBooking);
    },
  });
}
