import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { kickDeliveryWorker } from "./kick";
import { resolveRecipients } from "./recipients";
import { whatsappEnv } from "./env";
import { isEmail } from "./phone";
import { normalizeContacts, type BookingContact } from "./contacts";
import { buildBookingStatementPdf } from "./pdf";
import {
  bookingWhatsAppParams,
  paymentWhatsAppParams,
  bookingDeepLinkParam,
  buildBookingEmail,
  buildPaymentEmail,
  buildBookingCreatedEmail,
  buildPaymentReceivedCustomerEmail,
  buildPaymentReviewedCustomerEmail,
  buildOverdueEmail
} from "./templates";
import type { OutboundEvent } from "./types";

async function statementAttachment(
  bookingRef: string,
  project: string,
  unit: string,
  customerName: string,
  totalValue: number,
  totalPaid: number,
  remaining: number,
  receipts: { no: string; date: string; mode: string; amount: number; ref?: string }[] = []
): Promise<{ filename: string; base64: string } | null> {
  try {
    const brand = project.toLowerCase().includes("aurum") ? "AURUM" : project.toLowerCase().includes("tatva") ? "TATVA" : project.replace(/\s+/g, "_").toUpperCase();
    const filename = `${brand}_Statement_${bookingRef}.pdf`;
    const bytes = await buildBookingStatementPdf({
      bookingRef,
      project,
      unit,
      customerName,
      totalValue,
      totalPaid,
      remaining,
      receipts,
    });
    const base64 = Buffer.from(bytes).toString("base64");
    return { filename, base64 };
  } catch (e) {
    console.error("[outbound] pdf generation failed", e);
    return null;
  }
}

/**
 * How long the customer "pending verification" note waits before sending, so a
 * fast approval can supersede it. Ten minutes: long enough to absorb a prompt
 * review, short enough that a real backlog still gets acknowledged.
 */
const PENDING_NOTE_HOLD_MS = 10 * 60 * 1000;

/**
 * Everyone on the booking who should get the customer-facing copy.
 *
 * Falls back to the primary address when the caller did not resolve the
 * junction table, so an older call site still reaches at least the main buyer
 * rather than silently sending nothing.
 */
function customerAudience(d: {
  contacts?: BookingContact[];
  customerEmail: string | null;
  customerName: string;
}): BookingContact[] {
  if (d.contacts?.length) return normalizeContacts(d.contacts);
  return normalizeContacts([{ name: d.customerName, email: d.customerEmail, isPrimary: true }]);
}

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
  const wa = whatsappEnv();
  const rows: Record<string, unknown>[] = [];

  // The overdue chaser is addressed to one employee, so it needs neither the
  // ops alert list nor the customer fan-out. Handled first and returned early.
  if (event.key === "PAYMENT_OVERDUE") {
    const d = event.data;
    if (!isEmail(d.ownerEmail)) return { ids: [] };
    const mail = buildOverdueEmail(d);
    const { data, error } = await admin
      .from("notification_deliveries")
      .upsert(
        [
          {
            event_key: event.key,
            channel: "EMAIL",
            recipient: d.ownerEmail.toLowerCase(),
            entity_type: "booking",
            entity_id: event.entityId,
            subject: mail.subject,
            payload: { html: mail.html, text: mail.text, threadKey: `overdue-${d.bookingUuid}` },
            // The stage is part of the key, so re-running today's sweep is a
            // no-op while next week's escalation still sends.
            dedupe_key: `${event.key}:${event.entityId}:${d.stage}:EMAIL:${d.ownerEmail.toLowerCase()}`
          }
        ],
        { onConflict: "dedupe_key", ignoreDuplicates: true }
      )
      .select("id");
    if (error) {
      console.error("[outbound] overdue enqueue failed", error.message);
      return { ids: [] };
    }
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    if (ids.length) kickDeliveryWorker();
    return { ids };
  }

  const rec = await resolveRecipients(event.key);

  if (event.key === "BOOKING_SUBMITTED") {
    const d = event.data;
    const mail = buildBookingEmail(d);
    const attach = await statementAttachment(d.bookingRef, d.project, d.unit, d.customerName, d.totalValue, 0, d.totalValue, []);
    const attachments = attach ? [{ filename: attach.filename, content: attach.base64, contentType: "application/pdf" }] : undefined;
    for (const to of rec.email) {
      rows.push({
        event_key: event.key,
        channel: "EMAIL",
        recipient: to,
        entity_type: "booking",
        entity_id: event.entityId,
        subject: mail.subject,
        payload: { html: mail.html, text: mail.text, threadKey: `booking-${d.bookingUuid}`, attachments },
        dedupe_key: `${event.key}:${event.entityId}:EMAIL:${to}`
      });
    }

    // Customer-facing confirmation — one personalised copy per person named on
    // the booking, primary buyer and co-buyers alike.
    for (const person of customerAudience(d)) {
      const customerMail = buildBookingCreatedEmail(d, person.name, person.email);
      rows.push({
        event_key: "BOOKING_CREATED_CUSTOMER",
        channel: "EMAIL",
        recipient: person.email,
        entity_type: "booking",
        entity_id: event.entityId,
        subject: customerMail.subject,
        payload: {
          html: customerMail.html,
          text: customerMail.text,
          threadKey: `booking-${d.bookingUuid}`,
          attachments
        },
        dedupe_key: `BOOKING_CREATED_CUSTOMER:${event.entityId}:EMAIL:${person.email}`
      });
    }

    for (const to of rec.whatsapp) {
      rows.push({
        event_key: event.key,
        channel: "WHATSAPP",
        recipient: to,
        entity_type: "booking",
        entity_id: event.entityId,
        template_name: wa.templateBooking,
        payload: {
          bodyParams: bookingWhatsAppParams(d)
        },
        dedupe_key: `${event.key}:${event.entityId}:WHATSAPP:${to}`
      });
    }
  } else {
    const d: any = event.data;
    // Build statement PDF to attach – project-specific filename (AURUM/TATVA)
    const paymentReceipt = [{
      no: (d.reference ?? d.bookingRef ?? "").slice(0, 18) || d.bookingRef,
      date: d.paymentDate ? new Date(d.paymentDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
      mode: d.mode ?? "ONLINE",
      amount: d.amount ?? 0,
      ref: d.reference ?? undefined,
      bankName: d.mode ?? "Online Payment",
      instrumentDate: d.paymentDate ?? new Date().toISOString().slice(0, 10),
      instrumentNo: d.reference ? `BY TRANSFER-RTGS UTR NO: ${d.reference}` : "BY TRANSFER-RTGS UTR NO: HD",
    }];
    const payAttach = await statementAttachment(
      d.bookingRef,
      d.project ?? "Project",
      d.unit ?? "",
      d.customerName,
      d.totalValue ?? d.amount + d.remainingBalance,
      d.totalPaid ?? (d.totalValue ? d.totalValue - d.remainingBalance : d.amount),
      d.remainingBalance,
      paymentReceipt
    );
    const payAttachments = payAttach ? [{ filename: payAttach.filename, content: payAttach.base64, contentType: "application/pdf" }] : undefined;

    // Internal ops copy. Only for a newly recorded payment — a verification
    // decision is not something the ops list needs a second email about.
    if (event.key === "PAYMENT_ADDED") {
      const mail = buildPaymentEmail(d);
      for (const to of rec.email) {
        rows.push({
          event_key: event.key,
          channel: "EMAIL",
          recipient: to,
          entity_type: "payment",
          entity_id: event.entityId,
          subject: mail.subject,
          payload: { html: mail.html, text: mail.text, attachments: payAttachments },
          dedupe_key: `${event.key}:${event.entityId}:EMAIL:${to}`
        });
      }
    }

    // Customer copy — sent on BOTH events, to every person on the booking,
    // because email is their only channel.
    for (const person of customerAudience(d)) {
      const mail =
        event.key === "PAYMENT_REVIEWED"
          ? buildPaymentReviewedCustomerEmail(d, person.name, person.email)
          : buildPaymentReceivedCustomerEmail(d, person.name, person.email);
      // The decision is part of the key so approve-after-reject still sends.
      const suffix = event.key === "PAYMENT_REVIEWED" ? `:${d.decision}` : "";

      /**
        * Hold the "payment recorded, pending verification" note briefly.
        *
        * Accountants often approve within a minute, and the customer was then
        * getting two emails about one payment back to back — the first already
        * obsolete. Delaying it means a quick approval produces exactly one
        * email (the outcome), while a genuinely slow one still gets its
        * acknowledgement. The review route cancels this row if it wins the race.
        *
        * The verification outcome always goes out immediately.
        */
      const holdMs = event.key === "PAYMENT_ADDED" ? PENDING_NOTE_HOLD_MS : 0;

      rows.push({
        event_key: `${event.key}_CUSTOMER`,
        channel: "EMAIL",
        recipient: person.email,
        entity_type: "payment",
        entity_id: event.entityId,
        subject: mail.subject,
        payload: { html: mail.html, text: mail.text, threadKey: `booking-${d.bookingUuid}`, attachments: payAttachments },
        next_attempt_at: new Date(Date.now() + holdMs).toISOString(),
        dedupe_key: `${event.key}_CUSTOMER:${event.entityId}${suffix}:EMAIL:${person.email}`
      });
    }

    // WhatsApp goes to the internal ops list only, and only for new payments.
    // Links removed per request – keep only bodyParams, no urlButtonParam
    for (const to of event.key === "PAYMENT_ADDED" ? rec.whatsapp : []) {
      rows.push({
        event_key: event.key,
        channel: "WHATSAPP",
        recipient: to,
        entity_type: "payment",
        entity_id: event.entityId,
        template_name: wa.templatePayment,
        payload: {
          bodyParams: paymentWhatsAppParams(d)
        },
        dedupe_key: `${event.key}:${event.entityId}:WHATSAPP:${to}`
      });
    }
  }

  // Record unusable destinations so bad phone/email data is visible instead of
  // silently vanishing. Doubles as a data-quality report.
  for (const bad of rec.invalid) {
    rows.push({
      event_key: event.key,
      channel: bad.channel,
      recipient: bad.raw,
      entity_type: event.key === "BOOKING_SUBMITTED" ? "booking" : "payment",
      entity_id: event.entityId,
      status: "SKIPPED",
      provider: "none",
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

/**
 * Send one already-rendered email to one address, outside the event taxonomy.
 *
 * Used by the security alerter, which addresses named Directors rather than a
 * configured recipient list and must not be affected by the recipient cache.
 */
export async function enqueueDirectEmail(input: {
  eventKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  entityType: string;
  entityId: string;
  dedupeKey: string;
  threadKey?: string;
}): Promise<boolean> {
  if (!isEmail(input.to)) return false;
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("notification_deliveries")
      .upsert(
        [
          {
            event_key: input.eventKey,
            channel: "EMAIL",
            recipient: input.to.toLowerCase(),
            entity_type: input.entityType,
            entity_id: input.entityId,
            subject: input.subject,
            payload: { html: input.html, text: input.text, threadKey: input.threadKey },
            dedupe_key: input.dedupeKey
          }
        ],
        { onConflict: "dedupe_key", ignoreDuplicates: true }
      )
      .select("id");
    if (error) {
      console.error("[outbound] direct enqueue failed", error.message);
      return false;
    }
    if (data?.length) kickDeliveryWorker();
    return Boolean(data?.length);
  } catch (e) {
    console.error("[outbound] direct enqueue threw", e);
    return false;
  }
}
