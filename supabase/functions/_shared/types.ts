export type Channel = "WHATSAPP" | "EMAIL";

export type SendResult =
  | { ok: true; provider: string; providerMessageId: string | null; skipped?: boolean }
  | { ok: false; provider: string; errorCode: string; errorMessage: string; retryable: boolean };

/**
 * One row of the outbox. The payload is already fully rendered by the Next.js
 * app at enqueue time, so the worker never needs the template or recipient
 * modules — it only ships what is already here.
 */
export type DeliveryRow = {
  id: string;
  event_key: string;
  channel: Channel;
  recipient: string;
  entity_id: string | null;
  template_name: string | null;
  subject: string | null;
  payload: {
    // EMAIL
    html?: string;
    text?: string;
    // WHATSAPP
    bodyParams?: string[];
    urlButtonParam?: string;
  } | null;
  attempts: number;
  max_attempts: number;
};
