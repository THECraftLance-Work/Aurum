import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import type { SendResult } from "./types.ts";
import { emailConfigured, gmailEnv } from "./env.ts";

/**
 * Gmail SMTP, replacing Resend.
 *
 * Port 465 with implicit TLS — NOT 587. Supabase's docs used to claim outbound
 * 25/465/587 were all blocked; that was inaccurate for 465 and has since been
 * corrected (supabase/supabase#21977). 587 is STARTTLS and is not a safe
 * assumption here, so we pin 465.
 *
 * Auth is a 16-character Google App Password, which requires 2-Step
 * Verification on the account. Limits: 500 recipients/day on free Gmail,
 * 2,000 on Workspace, 100 recipients per message on either.
 */

/** SMTP reply codes in the 5xx range are permanent; 4xx are transient. */
function classifySmtpError(message: string): boolean {
  const m = message.toLowerCase();

  // Authentication failures never fix themselves on retry — the App Password
  // is wrong, revoked, or 2FA was turned off on the account.
  if (m.includes("535") || m.includes("invalid login") || m.includes("username and password not accepted")) {
    return false;
  }
  // Bad recipient address.
  if (m.includes("550") || m.includes("553") || m.includes("no such user")) return false;

  // Rate limiting / temporary deferral — worth retrying.
  if (m.includes("421") || m.includes("450") || m.includes("451") || m.includes("452")) return true;
  if (m.includes("rate") || m.includes("too many") || m.includes("try again")) return true;

  // Connection-level problems are transient by default.
  return true;
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!emailConfigured()) {
    console.info("[worker:email:noop]", JSON.stringify({ to: input.to, subject: input.subject }));
    return { ok: true, provider: "noop", providerMessageId: null, skipped: true };
  }

  const { user, appPassword, fromName } = gmailEnv();
  let client: SMTPClient | null = null;

  try {
    client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: user, password: appPassword }
      }
    });

    await client.send({
      from: `${fromName} <${user}>`,
      to: input.to,
      subject: input.subject,
      content: input.text,
      html: input.html
    });

    // SMTP gives us no provider-side message id to record.
    return { ok: true, provider: "gmail_smtp", providerMessageId: null };
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    return {
      ok: false,
      provider: "gmail_smtp",
      errorCode: "SMTP_ERROR",
      errorMessage: message,
      retryable: classifySmtpError(message)
    };
  } finally {
    // Leaking the connection wedges the isolate and eventually trips Gmail's
    // concurrent-connection limit.
    try { await client?.close(); } catch { /* already closed */ }
  }
}
