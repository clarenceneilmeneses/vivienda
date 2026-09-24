export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "declined";
export type BookingSource = "website" | "facebook" | "walk_in" | "phone" | "other";
export type PaymentMethod = "gcash" | "bank_transfer" | "cash" | "card" | "other";

export interface Settings {
  id: number;
  resort_name: string;
  tagline: string;
  about: string;
  email: string;
  phone: string;
  address: string;
  facebook_url: string;
  map_url: string;
  check_in_time: string;
  check_out_time: string;
  downpayment_percent: number;
  gcash_name: string;
  gcash_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  payment_instructions: string;
  house_rules: string;
  cancellation_policy: string;
  waiver: string;
  send_emails: boolean;
  admin_notify_email: string;
  reminder_days_before: number;
}

export interface Unit {
  id: string;
  name: string;
  slug: string;
  description: string;
  capacity: number;
  max_guests: number;
  base_rate: number;
  weekend_rate: number | null;
  extra_guest_fee: number;
  amenities: string[];
  photos: string[];
  is_active: boolean;
  sort_order: number;
}

export interface Guest {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string;
  created_at: string;
}

export interface Booking {
  id: string;
  ref: string;
  unit_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  status: BookingStatus;
  source: BookingSource;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod | null;
  receipt_path: string | null;
  special_requests: string;
  admin_notes: string;
  waiver_accepted_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingSummary extends Booking {
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  unit_name: string;
  nights: number;
  paid: number;
  balance: number;
}

export interface Payment {
  id: string;
  booking_id: string;
  kind: "payment" | "refund";
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  reference: string;
  notes: string;
  created_at: string;
}

export interface Expense {
  id: string;
  spent_on: string;
  category: string;
  description: string;
  amount: number;
  vendor: string;
  notes: string;
  created_at: string;
}

export interface EmailLog {
  id: string;
  booking_id: string | null;
  type: string;
  to_email: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  created_at: string;
}

export interface Quote {
  nights: number;
  room_total: number;
  extra_guest_total: number;
  total: number;
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  declined: "Declined",
};

export const SOURCE_LABEL: Record<BookingSource, string> = {
  website: "Website",
  facebook: "Facebook",
  walk_in: "Walk-in",
  phone: "Phone / SMS",
  other: "Other",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  gcash: "GCash",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export const EXPENSE_CATEGORIES = [
  { value: "utilities", label: "Utilities" },
  { value: "salaries", label: "Staff & salaries" },
  { value: "supplies", label: "Supplies & toiletries" },
  { value: "maintenance", label: "Repairs & maintenance" },
  { value: "cleaning", label: "Cleaning & laundry" },
  { value: "food", label: "Food & kitchen" },
  { value: "marketing", label: "Marketing & ads" },
  { value: "fees", label: "Fees & commissions" },
  { value: "taxes", label: "Taxes & permits" },
  { value: "other", label: "Other" },
] as const;

export function categoryLabel(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Statuses that hold the unit's nights. */
export const LIVE_STATUSES: BookingStatus[] = ["pending", "confirmed", "checked_in"];
/** Statuses that count as real stays for occupancy. */
export const STAY_STATUSES: BookingStatus[] = ["confirmed", "checked_in", "checked_out"];
