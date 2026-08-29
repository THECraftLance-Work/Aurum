export type Channel = "WHATSAPP" | "EMAIL";

export type EventKey = "BOOKING_SUBMITTED" | "PAYMENT_ADDED" | "PAYMENT_REVIEWED";

export type BookingAlertData = {
  bookingRef: string;
  bookingUuid: string;
  submitterName: string;
  customerName: string;
  customerEmail: string | null;
  project: string;
  unit: string;
  totalValue: number;
};

export type PaymentAlertData = {
  bookingRef: string;
  bookingUuid: string;
  submitterName: string;
  customerName: string;
  /** Drives the customer-facing copy of every payment email. */
  customerEmail: string | null;
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

export type OutboundEvent =
  | { key: "BOOKING_SUBMITTED"; entityId: string; data: BookingAlertData }
  | { key: "PAYMENT_ADDED"; entityId: string; data: PaymentAlertData }
  | { key: "PAYMENT_REVIEWED"; entityId: string; data: PaymentAlertData };

/**
 * Driver/SendResult types now live with the worker in
 * supabase/functions/_shared/types.ts — the web app only enqueues.
 */
