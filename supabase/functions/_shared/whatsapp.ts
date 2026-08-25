import type { SendResult } from "./types.ts";
import { whatsappConfigured, whatsappEnv } from "./env.ts";

/**
 * Meta error codes that will never succeed on retry. Retrying these just burns
 * quota and delays the FAILED verdict.
 *   131047 — outside the 24h window (we always send templates, so this means
 *            the template itself was rejected/paused)
 *   131026 — recipient is not a valid WhatsApp user
 *   132000 — template param count mismatch
 *   132001 — template does not exist / not approved in this locale
 *   132005 — template param content violates policy
 *   131008 — required parameter missing
 *   100    — malformed request
 */
const TERMINAL_CODES = new Set(["131047", "131026", "132000", "132001", "132005", "131008", "100"]);

/**
 * Transient: rate limits and Meta-side internal errors.
 *   130429 — rate limit hit
 *   131000 — generic Meta internal error
 *   133016 — account temporarily locked / in recovery
 */
const RETRYABLE_CODES = new Set(["130429", "131000", "133016"]);

function classify(status: number, code: string | undefined): boolean {
  if (code && TERMINAL_CODES.has(code)) return false;
  if (code && RETRYABLE_CODES.has(code)) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  if (status >= 400) return false; // other 4xx are client errors — don't retry
  return true;
}

/** Meta's Cloud API wants the number without the leading '+'. */
function toMetaRecipient(e164: string) {
  return e164.startsWith("+") ? e164.slice(1) : e164;
}

export async function sendWhatsAppTemplate(input: {
  to: string;
  template: string;
  bodyParams: string[];
  urlButtonParam?: string;
}): Promise<SendResult> {
  if (!whatsappConfigured()) {
    console.info("[worker:whatsapp:noop]", JSON.stringify({ to: input.to, template: input.template }));
    return { ok: true, provider: "noop", providerMessageId: null, skipped: true };
  }

  const { apiVersion, phoneNumberId, accessToken, locale } = whatsappEnv();

  const components: unknown[] = [
    { type: "body", parameters: input.bodyParams.map((text) => ({ type: "text", text })) }
  ];
  if (input.urlButtonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: input.urlButtonParam }]
    });
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toMetaRecipient(input.to),
    type: "template",
    template: { name: input.template, language: { code: locale }, components }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      }
    );

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = String(json?.error?.code ?? res.status);
      return {
        ok: false,
        provider: "meta_whatsapp",
        errorCode: code,
        errorMessage: json?.error?.message ?? `HTTP ${res.status}`,
        retryable: classify(res.status, code)
      };
    }

    return {
      ok: true,
      provider: "meta_whatsapp",
      providerMessageId: json?.messages?.[0]?.id ?? null
    };
  } catch (err) {
    // Network failure / timeout — always worth a retry.
    const e = err as Error;
    return {
      ok: false,
      provider: "meta_whatsapp",
      errorCode: e?.name === "AbortError" ? "TIMEOUT" : "NETWORK",
      errorMessage: String(e?.message ?? err),
      retryable: true
    };
  } finally {
    clearTimeout(timer);
  }
}
