export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "declined";
export type BookingSource = "website" | "facebook" | "walk_in" | "phone" | "other";
export type PayPlan = "downpayment" | "full";
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
  /** Email types switched off under Settings → Notifications. */
  disabled_emails: string[];
  /** Email the owner a summary of the day every morning. */
  daily_report: boolean;
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
  /** 0 means no pets. */
  max_pets: number;
  /** Per pet, once per stay. */
  pet_fee: number;
  min_nights: number;
  tour_video_url: string;
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
  /** Head count: adults plus children. */
  guests_count: number;
  children: number;
  pets: number;
  pet_total: number;
  pay_plan: PayPlan;
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
  /** A photo or PDF in the private 'receipts' bucket. */
  receipt_path?: string | null;
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
  /** A photo or PDF in the private 'receipts' bucket. */
  receipt_path?: string | null;
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
  pet_total: number;
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
  { value: "cleaning", label: "Cleaning" },
  { value: "laundry", label: "Laundry" },
  { value: "gas", label: "Gas (LPG)" },
  { value: "water", label: "Water delivery" },
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

export interface Conversation {
  id: string;
  guest_id: string;
  starred: boolean;
  archived_at: string | null;
  admin_unread: boolean;
  admin_seen_at: string | null;
  guest_seen_at: string | null;
  last_message_at: string;
  last_message_preview: string;
  last_author: "guest" | "host" | null;
  inquiry_check_in: string | null;
  inquiry_check_out: string | null;
  inquiry_guests: number | null;
  created_at: string;
}

export type MessageKind = "message" | "problem" | "booking";

export interface Message {
  id: string;
  conversation_id: string;
  author: "guest" | "host";
  author_name: string;
  kind: MessageKind;
  body: string;
  booking_id: string | null;
  edited_at: string | null;
  unsent_at: string | null;
  sent_at: string;
  reply_to: string | null;
  /** One reaction per side, e.g. { guest: "❤️" }. */
  reactions: { guest?: string; host?: string };
  attachment_path: string | null;
}

export const REACTIONS = ["❤️", "👍", "😂", "😮", "🙏"] as const;

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  /** Sent by itself when a booking is made or confirmed. */
  auto_send: "booking_created" | "booking_confirmed" | null;
}

export type ReviewSource = "website" | "airbnb" | "google" | "facebook" | "other";

export const REVIEW_SOURCE_LABEL: Record<ReviewSource, string> = {
  website: "Our website",
  airbnb: "Airbnb",
  google: "Google",
  facebook: "Facebook",
  other: "Other",
};

export interface ArrivalGuide {
  check_in_method: string;
  wifi_name: string;
  wifi_password: string;
  parking: string;
  house_manual: string;
  emergency: string;
}

export interface Review {
  id: string;
  booking_id: string | null;
  guest_id: string | null;
  source: ReviewSource;
  reviewer_name: string;
  reviewed_on: string | null;
  rating: number;
  body: string;
  status: "pending" | "published" | "hidden";
  host_reply: string;
  host_replied_at: string | null;
  created_at: string;
}
