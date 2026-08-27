import type { BookingAlertData, PaymentAlertData } from "./types";
import { appUrl } from "./env";

/**
 * Meta rejects template parameters containing newlines, tabs, or 4+ consecutive
 * spaces (errors 132000 / 131008). Collapse whitespace, strip control chars,
 * and cap length.
 */
export function sanitizeTemplateParam(v: string | number | null | undefined, max = 120): string {
  const s = String(v ?? "")
    // \p{C} = Unicode "Other" (control, format, surrogate, unassigned).
    // Written as a property escape so no literal control bytes live in source.
    .replace(/\p{C}/gu, " ")
    // \s covers newline and tab; collapsing runs also removes the 4+
    // consecutive spaces that Meta rejects.
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s || "-";
}

/**
 * Plain-ASCII rupee formatting for WhatsApp template params.
 *
 * formatINR() emits the rupee glyph via Intl; that glyph is a recurring source
 * of trouble in Meta's template review and in some Android renderers. Email
 * keeps the real glyph.
 */
export function formatINRPlain(n: number) {
  return "Rs " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n ?? 0));
}

function formatINRRich(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(Number(n ?? 0));
}

// ---------------------------------------------------------------------------
// WhatsApp body params — ORDER MUST MATCH the approved template exactly.
// ---------------------------------------------------------------------------

/** aurum_new_booking_alert: {{1}} ref, {{2}} submitter, {{3}} customer, {{4}} unit, {{5}} value */
export function bookingWhatsAppParams(d: BookingAlertData): string[] {
  return [
    sanitizeTemplateParam(d.bookingRef),
    sanitizeTemplateParam(d.submitterName),
    sanitizeTemplateParam(d.customerName),
    sanitizeTemplateParam(`${d.project} / ${d.unit}`),
    sanitizeTemplateParam(formatINRPlain(d.totalValue))
  ];
}

/** aurum_new_payment_alert: {{1}} ref, {{2}} amount, {{3}} mode, {{4}} added by, {{5}} balance */
export function paymentWhatsAppParams(d: PaymentAlertData): string[] {
  return [
    sanitizeTemplateParam(d.bookingRef),
    sanitizeTemplateParam(formatINRPlain(d.amount)),
    sanitizeTemplateParam(d.mode.replaceAll("_", " ")),
    sanitizeTemplateParam(d.submitterName),
    sanitizeTemplateParam(formatINRPlain(d.remainingBalance))
  ];
}

/** Dynamic-URL button param — appended to the template's base URL. */
export function bookingDeepLinkParam(bookingUuid: string) {
  return `bookings/${bookingUuid}`;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function shell(title: string, rows: [string, string][], ctaHref: string, ctaLabel: string) {
  const tr = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">${escapeHtml(k)}</td>` +
        `<td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;padding:24px;font-family:Archivo,system-ui,-apple-system,sans-serif">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px">
    <tr><td>
      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#ec3013;font-weight:700">Aurum Ops</div>
      <h1 style="margin:8px 0 16px;font-size:18px;color:#0f172a">${escapeHtml(title)}</h1>
      <table role="presentation" width="100%" style="border-top:1px solid #e2e8f0">${tr}</table>
      <a href="${escapeHtml(ctaHref)}" style="display:inline-block;margin-top:20px;background:#ec3013;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600">${escapeHtml(ctaLabel)}</a>
      <p style="margin-top:20px;font-size:11px;color:#94a3b8">Automated message from the Aurum internal operations platform.</p>
    </td></tr>
  </table></body></html>`;
}

export function buildBookingEmail(d: BookingAlertData) {
  const href = `${appUrl()}/bookings/${d.bookingUuid}`;
  const rows: [string, string][] = [
    ["Booking ID", d.bookingRef],
    ["Customer", d.customerName],
    ["Project / Unit", `${d.project} / ${d.unit}`],
    ["Total value", formatINRRich(d.totalValue)],
    ["Submitted by", d.submitterName]
  ];
  return {
    subject: `New booking ${d.bookingRef} awaiting verification`,
    html: shell("New booking submitted", rows, href, "Review booking"),
    text: [
      `New booking ${d.bookingRef} submitted by ${d.submitterName}.`,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      `Review: ${href}`
    ].join("\n")
  };
}

export function buildPaymentEmail(d: PaymentAlertData) {
  const href = `${appUrl()}/bookings/${d.bookingUuid}`;
  const rows: [string, string][] = [
    ["Booking ID", d.bookingRef],
    ["Customer", d.customerName],
    ["Amount", formatINRRich(d.amount)],
    ["Mode", d.mode.replaceAll("_", " ")],
    ["Remaining balance", formatINRRich(d.remainingBalance)],
    ["Added by", d.submitterName]
  ];
  return {
    subject: `New payment on ${d.bookingRef} awaiting verification`,
    html: shell("New payment recorded", rows, href, "Review payment"),
    text: [
      `New payment recorded on ${d.bookingRef} by ${d.submitterName}.`,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      `Review: ${href}`
    ].join("\n")
  };
}

export function buildBookingCreatedEmail(d: BookingAlertData) {
  const href = `${appUrl()}/bookings/${d.bookingUuid}`;
  const rows: [string, string][] = [
    ["Booking Reference", d.bookingRef],
    ["Customer Name", d.customerName],
    ["Project", d.project],
    ["Unit Number", d.unit],
    ["Property Value", formatINRRich(d.totalValue)],
    ["Booking Date", new Date().toLocaleDateString("en-IN", { dateStyle: "long" })],
    ["Submitted by", d.submitterName],
    ["Status", "Submitted for Verification"]
  ];
  return {
    subject: `Booking Confirmed: ${d.bookingRef} - ${d.project} / ${d.unit}`,
    html: shell("Your Booking has been Submitted", rows, href, "View Booking Details"),
    text: [
      `Dear ${d.customerName},`,
      ``,
      `Your booking has been successfully submitted by ${d.submitterName}.`,
      `Here are the details:`,
      ``,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ``,
      `Your booking is now under verification by our accounts team.`,
      `You will receive updates once the verification is complete.`,
      ``,
      `View your booking: ${href}`,
      ``,
      `Thank you for choosing Aurum Real Estate.`,
      `If you have any questions, please contact your sales representative.`
    ].join("\n")
  };
}

export function buildWelcomeEmail(userName: string, userEmail: string, userRole: string) {
  const href = appUrl();
  const rows: [string, string][] = [
    ["Name", userName],
    ["Email", userEmail],
    ["Role", userRole],
    ["Platform", "Aurum Real Estate Operations"]
  ];
  return {
    subject: `Welcome to Aurum Real Estate Operations Platform`,
    html: shell("Welcome to Aurum Ops!", rows, href, "Access Dashboard"),
    text: [
      `Welcome to Aurum Real Estate Operations Platform, ${userName}!`,
      `Your account has been set up with the role: ${userRole}`,
      `You can now access the platform at: ${href}`,
      `If you have any questions, please contact your administrator.`
    ].join("\n")
  };
}
