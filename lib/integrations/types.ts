import type { BookingContact } from "./contacts";

export type Channel = "WHATSAPP" | "EMAIL";

export type EventKey =
  | "BOOKING_SUBMITTED"
  | "PAYMENT_ADDED"
  | "PAYMENT_REVIEWED"
  | "PAYMENT_OVERDUE";

export type BookingAlertData = {
  bookingRef: string;
  bookingUuid: string;
  submitterName: string;
  customerName: string;
  customerEmail: string | null;
  /**
   * Everyone attached to the booking — primary buyer plus co-buyers added at
   * creation or later via Attach person. Customer-facing mail fans out across
   * this list; `customerEmail` above is only the primary, kept for the WhatsApp
   * params and the subject line.
   */
  contacts?: BookingContact[];
  project: string;
  unit: string;
  totalValue: number;
};

export type PaymentAlertData = {
  bookingRef: string;
  bookingUuid: string;
  project: string;
  unit: string;
  submitterName: string;
  customerName: string;
  /** Primary customer address. See `contacts` for the full fan-out list. */
  customerEmail: string | null;
  contacts?: BookingContact[];
  amount: number;
  mode: string;
  reference?: string | null;
  paymentDate?: string | null;
  remainingBalance: number;
  totalPaid?: number;
  totalValue?: number;
  /** Set on PAYMENT_REVIEWED. */
  decision?: "APPROVED" | "REJECTED";
  reviewerName?: string;
  rejectionReason?: string | null;
};

/**
 * A booking whose balance is still outstanding well past its booking date.
 *
 * Unlike every other event this one is addressed to the employee who owns the
 * booking, not to the customer: it is a prompt to go and chase payment, so it
 * carries the customer's contact details rather than being sent to them.
 */
export type OverdueAlertData = {
  bookingRef: string;
  bookingUuid: string;
  /** Employee who created the booking — the person being asked to follow up. */
  ownerName: string;
  ownerEmail: string;
  project: string;
  unit: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  totalValue: number;
  totalPaid: number;
  remainingBalance: number;
  daysOverdue: number;
  bookingDate: string | null;
  lastPaymentDate: string | null;
  /** Escalation bucket, e.g. "W1" (one week) or "M2" (two months). */
  stage: string;
};

export type OutboundEvent =
  | { key: "BOOKING_SUBMITTED"; entityId: string; data: BookingAlertData }
  | { key: "PAYMENT_ADDED"; entityId: string; data: PaymentAlertData }
  | { key: "PAYMENT_REVIEWED"; entityId: string; data: PaymentAlertData }
  | { key: "PAYMENT_OVERDUE"; entityId: string; data: OverdueAlertData };

/**
 * Driver/SendResult types now live with the worker in
 * supabase/functions/_shared/types.ts — the web app only enqueues.
 */
