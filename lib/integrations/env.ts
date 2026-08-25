/**
 * Env for the enqueue side of the outbound bridge.
 *
 * The web app no longer delivers anything, so it holds no WhatsApp access
 * token, no phone number ID and no Gmail password — those live only in the
 * Supabase Edge Function's secrets. All that remains here is what is written
 * into the delivery row at enqueue time.
 */

export const whatsappEnv = () => ({
  templateBooking: process.env.WHATSAPP_TEMPLATE_BOOKING ?? "aurum_new_booking_alert",
  templatePayment: process.env.WHATSAPP_TEMPLATE_PAYMENT ?? "aurum_new_payment_alert"
});

export const bootstrapRecipients = () => ({
  emails: (process.env.OPS_ALERT_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  whatsapp: (process.env.OPS_ALERT_WHATSAPP ?? "").split(",").map((s) => s.trim()).filter(Boolean)
});

export const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
