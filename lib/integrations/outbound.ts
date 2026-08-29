import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { kickDeliveryWorker } from "./kick";
import { resolveRecipients } from "./recipients";
import { whatsappEnv } from "./env";
import { isEmail } from "./phone";
import {
  bookingWhatsAppParams, paymentWhatsAppParams, bookingDeepLinkParam,
  buildBookingEmail, buildPaymentEmail, buildBookingCreatedEmail,
  buildPaymentReceivedCustomerEmail, buildPaymentReviewedCustomerEmail
} from "./templates";
import type { OutboundEvent } from "./types";

/**
 * Enqueue one outbound delivery row per recipient per channel.
 *
 * This is ALL the web app does — a single batched insert on the request's
 * critical path. Delivery itself happens in the Supabase Edge Function
 * `dispatch-notifications`, triggered by a Database Webhook on this insert
 * (near-instant) with pg_cron every 5 minutes as the retry safety net.
 *
 * That split is why the payload is rendered here rather than in the worker:
 * the row carries everything needed to send, so the worker needs no templates,
 * no recipient resolution, and no WhatsApp/Gmail credentials in the web app.
 */
export async function enqueueOutbound(event: OutboundEvent): Promise<{ ids: string[] }> {
  const admin = createSupabaseAdmin();
  const rec = await resolveRecipients(event.key);
  const wa = whatsappEnv();

  const rows: Record<string, unknown>[] = [];

  if (event.key === "BOOKING_SUBMITTED") {
    const d = event.data;
    const mail = buildBookingEmail(d);
    for (const to of rec.email) {
      rows.push({
        event_key: event.key, channel: "EMAIL", recipient: to,
        entity_type: "booking", entity_id: event.entityId,
        subject: mail.subject,
        payload: { html: mail.html, text: mail.text },
        dedupe_key: `${event.key}:${event.entityId}:EMAIL:${to}`
      });
    }

    // Customer-facing confirmation email
    if (d.customerEmail && isEmail(d.customerEmail)) {
      const customerMail = buildBookingCreatedEmail(d);
      rows.push({
        event_key: "BOOKING_CREATED_CUSTOMER",
        channel: "EMAIL",
        recipient: d.customerEmail,
        entity_type: "booking",
        entity_id: event.entityId,
        subject: customerMail.subject,
        payload: { html: customerMail.html, text: customerMail.text },
        dedupe_key: `BOOKING_CREATED_CUSTOMER:${event.entityId}:EMAIL:${d.customerEmail}`
      });
    }

    for (const to of rec.whatsapp) {
      rows.push({
        event_key: event.key, channel: "WHATSAPP", recipient: to,
        entity_type: "booking", entity_id: event.entityId,
        template_name: wa.templateBooking,
        payload: {
          bodyParams: bookingWhatsAppParams(d),
          urlButtonParam: bookingDeepLinkParam(d.bookingUuid)
        },
        dedupe_key: `${event.key}:${event.entityId}:WHATSAPP:${to}`
      });
    }
  } else {
    const d = event.data;

    // Internal ops copy. Only for a newly recorded payment — a verification
    // decision is not something the ops list needs a second email about.
    if (event.key === "PAYMENT_ADDED") {
      const mail = buildPaymentEmail(d);
      for (const to of rec.email) {
        rows.push({
          event_key: event.key, channel: "EMAIL", recipient: to,
          entity_type: "payment", entity_id: event.entityId,
          subject: mail.subject,
          payload: { html: mail.html, text: mail.text },
          dedupe_key: `${event.key}:${event.entityId}:EMAIL:${to}`
        });
      }
    }

    // Customer copy — sent on BOTH events, because email is the customer's
    // only channel and they previously heard nothing after booking creation.
    if (d.customerEmail && isEmail(d.customerEmail)) {
      const mail = event.key === "PAYMENT_REVIEWED"
        ? buildPaymentReviewedCustomerEmail(d)
        : buildPaymentReceivedCustomerEmail(d);
      // The decision is part of the key so approve-after-reject still sends.
      const suffix = event.key === "PAYMENT_REVIEWED" ? `:${d.decision}` : "";
      rows.push({
        event_key: `${event.key}_CUSTOMER`,
        channel: "EMAIL",
        recipient: d.customerEmail,
        entity_type: "payment",
        entity_id: event.entityId,
        subject: mail.subject,
        payload: { html: mail.html, text: mail.text },
        dedupe_key: `${event.key}_CUSTOMER:${event.entityId}${suffix}:EMAIL:${d.customerEmail}`
      });
    }

    // WhatsApp goes to the internal ops list only, and only for new payments.
    for (const to of event.key === "PAYMENT_ADDED" ? rec.whatsapp : []) {
      rows.push({
        event_key: event.key, channel: "WHATSAPP", recipient: to,
        entity_type: "payment", entity_id: event.entityId,
        template_name: wa.templatePayment,
        payload: {
          bodyParams: paymentWhatsAppParams(d),
          urlButtonParam: bookingDeepLinkParam(d.bookingUuid)
        },
        dedupe_key: `${event.key}:${event.entityId}:WHATSAPP:${to}`
      });
    }
  }

  // Record unusable destinations so bad phone/email data is visible instead of
  // silently vanishing. Doubles as a data-quality report.
  for (const bad of rec.invalid) {
    rows.push({
      event_key: event.key, channel: bad.channel, recipient: bad.raw,
      entity_type: event.key === "BOOKING_SUBMITTED" ? "booking" : "payment",
      entity_id: event.entityId, status: "SKIPPED", provider: "none",
      error_code: bad.channel === "EMAIL" ? "INVALID_EMAIL" : "INVALID_PHONE",
      error_message: bad.reason,
      dedupe_key: `${event.key}:${event.entityId}:${bad.channel}:${bad.raw}`
    });
  }

  if (rows.length === 0) return { ids: [] };

  const { data, error } = await admin
    .from("notification_deliveries")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[outbound] enqueue failed", error.message);
    return { ids: [] };
  }

  const ids = (data ?? []).map((r: { id: string }) => r.id);

  // Hand off to the worker immediately rather than waiting on the DB webhook /
  // pg_cron, which silently do nothing if migration 0008 or the Vault secrets
  // are missing. Fire-and-forget; cron still covers retries.
  if (ids.length) kickDeliveryWorker();

  return { ids };
}

/**
 * Enqueue without ever throwing.
 *
 * An alerting failure must never turn a successfully-created booking or
 * payment into a 500.
 */
export async function dispatchOutbound(event: OutboundEvent) {
  try {
    await enqueueOutbound(event);
  } catch (e) {
    console.error("[outbound] enqueue threw", e);
  }
}
