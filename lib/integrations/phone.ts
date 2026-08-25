export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; reason: "EMPTY" | "UNPARSEABLE" | "PLACEHOLDER" };

/**
 * Normalize a free-text phone number to E.164.
 *
 * Numbers in this system are hand-entered (customers.phone, app_users.phone,
 * notification_recipients.destination), so they arrive as "+91 98765 43210",
 * "098765 43210", "9876543210", etc. Never throws — callers record failures as
 * SKIPPED deliveries, which doubles as a data-quality report.
 */
export function toE164(
  raw: string | null | undefined,
  defaultCc: string = process.env.DEFAULT_COUNTRY_CODE ?? "91"
): PhoneResult {
  if (!raw || !raw.trim()) return { ok: false, reason: "EMPTY" };

  let s = raw.trim();
  if (s.startsWith("00")) s = "+" + s.slice(2);

  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (!digits) return { ok: false, reason: "UNPARSEABLE" };

  // Obvious placeholders: +919999999999, 0000000000, etc.
  if (/^(\d)\1+$/.test(digits)) return { ok: false, reason: "PLACEHOLDER" };

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return { ok: false, reason: "UNPARSEABLE" };
    return { ok: true, e164: "+" + digits };
  }

  // India-specific rules (mobile series is 6-9); generalises via defaultCc.
  if (defaultCc === "91") {
    if (digits.length === 10 && /^[6-9]/.test(digits)) return { ok: true, e164: "+91" + digits };
    if (digits.length === 11 && digits.startsWith("0")) return toE164(digits.slice(1), defaultCc);
    if (digits.length === 12 && digits.startsWith("91")) return { ok: true, e164: "+" + digits };
    if (digits.length === 13 && digits.startsWith("091")) return { ok: true, e164: "+" + digits.slice(1) };
    return { ok: false, reason: "UNPARSEABLE" };
  }

  if (digits.length >= 8 && digits.length <= 15) return { ok: true, e164: "+" + defaultCc + digits };
  return { ok: false, reason: "UNPARSEABLE" };
}

/** Meta's Cloud API wants the number without the leading '+'. */
export function toMetaRecipient(e164: string) {
  return e164.startsWith("+") ? e164.slice(1) : e164;
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
