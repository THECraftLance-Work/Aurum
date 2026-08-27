import nodemailer from "npm:nodemailer@^6.9.14";
import type { SendResult } from "./types.ts";
import { smtpConfigured, smtpEnv } from "./env.ts";

/**
 * Plain SMTP via nodemailer.
 *
 * nodemailer, not denomailer: denomailer fails on `Deno.connectTls` inside edge
 * runtimes, and nodemailer over Deno's npm-compat layer is what Supabase's own
 * `send-email-smtp` example ships. Works with any SMTP server — Gmail, your
 * host's mail server, Zoho, Fastmail, an internal relay.
 *
 * Port 465 => secure: true (implicit TLS). Port 587 => secure: false, and
 * nodemailer upgrades via STARTTLS. Getting this pair wrong is the single most
 * common cause of a connection that hangs and then times out.
 */

/** 5xx SMTP replies are permanent; 4xx are transient. */
function classifySmtpError(err: unknown): { code: string; message: string; retryable: boolean } {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const message = String(e?.message ?? err);
  const responseCode = e?.responseCode;
  const code = e?.code ?? (responseCode ? String(responseCode) : "SMTP_ERROR");

  // Authentication failures never fix themselves on retry: wrong password,
  // revoked App Password, or 2FA turned off on the account.
  if (responseCode === 535 || responseCode === 534 || /invalid login|username and password not accepted|authentication failed/i.test(message)) {
    return { code: "SMTP_AUTH", message, retryable: false };
  }
  // Bad recipient.
  if (responseCode === 550 || responseCode === 553 || responseCode === 501) {
    return { code: String(responseCode), message, retryable: false };
  }
  // Any other permanent 5xx.
  if (responseCode && responseCode >= 500 && responseCode < 600) {
    return { code: String(responseCode), message, retryable: false };
  }
  // Transient: 4xx deferrals, rate limits, DNS/connection problems, timeouts.
  return { code, message, retryable: true };
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!smtpConfigured()) {
    console.info("[worker:email:noop]", JSON.stringify({ to: input.to, subject: input.subject }));
    return { ok: true, provider: "noop", providerMessageId: null, skipped: true };
  }

  const { host, port, secure, user, password, from } = smtpEnv();
  let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

  try {
    transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: password },
      // Edge isolates are short-lived; don't wait forever on a wedged socket.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000
    });

    const info = await transport.sendMail({
      from: from || user,
      to: input.to.join(", "),
      subject: input.subject,
      text: input.text,
      html: input.html
    });

    return {
      ok: true,
      provider: "smtp",
      providerMessageId: (info as { messageId?: string })?.messageId ?? null
    };
  } catch (err) {
    const { code, message, retryable } = classifySmtpError(err);
    console.error("[worker:email] send failed", code, message);
    return { ok: false, provider: "smtp", errorCode: code, errorMessage: message, retryable };
  } finally {
    // Leaking the pool wedges the isolate and eventually trips the server's
    // concurrent-connection limit.
    try { transport?.close(); } catch { /* already closed */ }
  }
}
