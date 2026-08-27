export type Channel = "WHATSAPP" | "EMAIL";

export type EventKey = "BOOKING_SUBMITTED" | "PAYMENT_ADDED";

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
  amount: number;
  mode: string;
  remainingBalance: number;
};

export type OutboundEvent =
  | { key: "BOOKING_SUBMITTED"; entityId: string; data: BookingAlertData }
  | { key: "PAYMENT_ADDED"; entityId: string; data: PaymentAlertData };

/**
 * Driver/SendResult types now live with the worker in
 * supabase/functions/_shared/types.ts — the web app only enqueues.
 */
