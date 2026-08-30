import nodemailer from "npm:nodemailer@^6.9.14";
import type { SendResult } from "./types.ts";
import { smtpConfigured, smtpEnv } from "./env.ts";

/**
 * Plain SMTP via nodemailer.
 *
 * nodemailer, not denomailer: denomailer fails on `Deno.connectTls` inside edge
 * runtimes, and nodemailer over Deno's npm-compat layer is what Supabase's own
 * `send-email-smtp` example ships. Works with any SMTP server.
 *
 * Port 465 => secure: true (implicit TLS). Port 587 => secure: false, upgraded
 * via STARTTLS. Getting that pair wrong is the most common cause of a
 * connection that hangs and then times out.
 */

/** 5xx SMTP replies are permanent; 4xx are transient. */
function classifySmtpError(err: unknown): { code: string; message: string; retryable: boolean } {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const message = String(e?.message ?? err);
  const responseCode = e?.responseCode;
  const code = e?.code ?? (responseCode ? String(responseCode) : "SMTP_ERROR");

  if (responseCode === 535 || responseCode === 534 ||
      /invalid login|username and password not accepted|authentication failed/i.test(message)) {
    return { code: "SMTP_AUTH", message, retryable: false };
  }
  if (responseCode === 550 || responseCode === 553 || responseCode === 501) {
    return { code: String(responseCode), message, retryable: false };
  }
  if (responseCode && responseCode >= 500 && responseCode < 600) {
    return { code: String(responseCode), message, retryable: false };
  }
  return { code, message, retryable: true };
}

/** Split `Name <addr@host>` into its parts. */
function parseFrom(raw: string): { name: string | null; address: string | null } {
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, "") || null, address: m[2].trim() };
  const t = raw.trim();
  return { name: null, address: t.includes("@") ? t : null };
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Stable per-booking key — makes every mail about one booking thread together. */
  threadKey?: string | null;
}): Promise<SendResult> {
  if (!smtpConfigured()) {
    console.info("[worker:email:noop]", JSON.stringify({ to: input.to, subject: input.subject }));
    return { ok: true, provider: "noop", providerMessageId: null, skipped: true };
  }

  const { host, port, secure, user, password, from } = smtpEnv();

  /**
   * The From address MUST be the authenticated mailbox.
   *
   * Gmail (and most providers) rewrite or penalise a From that isn't the
   * account that authenticated — it reads as spoofing and is a strong spam
   * signal. So keep the configured display name but force the address to the
   * authenticated user, and say so loudly if they disagree.
   */
  const parsed = parseFrom(from || user);
  const displayName = parsed.name ?? "Aurum Ops";
  if (parsed.address && parsed.address.toLowerCase() !== user.toLowerCase()) {
    console.warn(
      `[worker:email] SMTP_FROM address (${parsed.address}) does not match SMTP_USER (${user}). ` +
      `Using SMTP_USER to keep the From aligned — a mismatch gets mail flagged as spam.`
    );
  }
  const fromHeader = `"${displayName.replace(/"/g, "")}" <${user}>`;
  const senderDomain = user.split("@")[1] ?? "localhost";

  // Threading: same booking -> same References, so Gmail collapses the run of
  // notifications into a single conversation instead of a burst of messages.
  const threadId = input.threadKey ? `<${input.threadKey}@${senderDomain}>` : null;

  const headers: Record<string, string> = {
    // The strongest single deliverability signal for automated mail. Gmail
    // surfaces a native unsubscribe control when both of these are present.
    "List-Unsubscribe": `<mailto:${user}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    // Marks this as transactional rather than bulk marketing.
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "OOF, AutoReply"
  };
  if (threadId) {
    headers["References"] = threadId;
    headers["In-Reply-To"] = threadId;
  }

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
      from: fromHeader,
      // Reply-To the real mailbox: a monitored address reads as legitimate,
      // and a customer replying to an update should reach someone.
      replyTo: user,
      to: input.to.join(", "),
      subject: input.subject,
      text: input.text,
      html: input.html,
      headers,
      // Align the SMTP envelope sender with the From header.
      envelope: { from: user, to: input.to }
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
    try { transport?.close(); } catch { /* already closed */ }
  }
}
