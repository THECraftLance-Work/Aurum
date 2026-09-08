import type { BookingAlertData, PaymentAlertData, OverdueAlertData } from "./types";
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

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(n ?? 0));
}

function longDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function modeLabel(mode: string) {
  const map: Record<string, string> = {
    BANK_TRANSFER: "Bank transfer / NEFT",
    UPI: "UPI",
    CHEQUE: "Cheque",
    CASH: "Cash",
    CARD: "Card",
    OTHER: "Other"
  };
  return map[mode] ?? String(mode ?? "").replaceAll("_", " ");
}

/** First name only — "Dear Rajesh" reads better than "Dear Rajesh Kumar Sharma". */
function firstName(full?: string | null) {
  const n = String(full ?? "").trim();
  if (!n) return "there";
  return n.split(/\s+/)[0];
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

// ===========================================================================
// Email rendering
//
// One renderer, used by every message. HTML and plain text are produced from
// the same structured input, so the two cannot drift apart — previously each
// builder hand-wrote its own text body and they had already diverged.
//
// Constraints this layout is built around:
//   - Tables, not flexbox. Outlook uses the Word rendering engine and ignores
//     modern CSS layout entirely.
//   - Inline styles only. Gmail strips <style> blocks in several contexts.
//   - An explicit background and text colour on every cell, so a client that
//     inverts the page for dark mode cannot leave dark text on dark ground.
//   - 600px content width with width="100%", so phones shrink the card rather
//     than scrolling sideways.
//   - A preheader — the grey line clients show next to the subject. Left unset
//     it fills with whatever text comes first, which looks unfinished.
// ===========================================================================

const BRAND = {
  name: "Aurum Real Estate",
  product: "Aurum Operations",
  accent: "#ec3013",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  page: "#f1f5f9",
  surface: "#ffffff",
  subtle: "#f8fafc"
};

const TONES = {
  neutral: { bg: "#f8fafc", border: "#e2e8f0", fg: "#0f172a", label: "#64748b" },
  positive: { bg: "#ecfdf5", border: "#a7f3d0", fg: "#065f46", label: "#047857" },
  warning: { bg: "#fffbeb", border: "#fde68a", fg: "#92400e", label: "#b45309" },
  negative: { bg: "#fef2f2", border: "#fecaca", fg: "#991b1b", label: "#b91c1c" }
} as const;

type Tone = keyof typeof TONES;
type Row = [label: string, value: string];
type Section = { title?: string; rows: Row[] };

type EmailInput = {
  /** Grey preview line shown beside the subject. Keep under ~90 characters. */
  preheader: string;
  /** Small uppercase kicker above the heading. */
  eyebrow: string;
  heading: string;
  greeting?: string;
  /** Paragraphs before the detail table. */
  intro?: string[];
  /** The one number that matters, shown large. */
  highlight?: { label: string; value: string; sub?: string; tone?: Tone };
  sections?: Section[];
  callout?: { tone: Tone; title?: string; text: string };
  cta?: { href: string; label: string };
  /** Paragraphs after the table and CTA. */
  outro?: string[];
  signoff?: string;
  /** Explains to the reader why they received this. */
  footerReason: string;
};

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

const FONT = "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif";

function renderRows(rows: Row[]) {
  return rows
    .map(([k, v], i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${BRAND.line};`;
      return (
        `<tr>` +
        `<td style="${border}padding:11px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${BRAND.muted};vertical-align:top;width:45%">${escapeHtml(k)}</td>` +
        `<td style="${border}padding:11px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${BRAND.ink};font-weight:600;text-align:right;vertical-align:top">${escapeHtml(v)}</td>` +
        `</tr>`
      );
    })
    .join("");
}

function renderHtml(o: EmailInput) {
  const paras = (list: string[] | undefined, color: string) =>
    (list ?? [])
      .map(
        (p) =>
          `<p style="margin:0 0 14px;font-family:${FONT};font-size:14px;line-height:22px;color:${color}">${escapeHtml(p)}</p>`
      )
      .join("");

  const sections = (o.sections ?? [])
    .filter((s) => s.rows.length)
    .map(
      (s) =>
        (s.title
          ? `<p style="margin:24px 0 6px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.faint}">${escapeHtml(s.title)}</p>`
          : `<div style="height:8px;line-height:8px">&nbsp;</div>`) +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse">${renderRows(s.rows)}</table>`
    )
    .join("");

  let highlight = "";
  if (o.highlight) {
    const t = TONES[o.highlight.tone ?? "neutral"];
    highlight =
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:separate;margin:4px 0 8px">` +
      `<tr><td style="background:${t.bg};border:1px solid ${t.border};border-radius:10px;padding:18px 20px">` +
      `<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${t.label}">${escapeHtml(o.highlight.label)}</p>` +
      `<p style="margin:0;font-family:${FONT};font-size:26px;line-height:32px;font-weight:700;color:${t.fg}">${escapeHtml(o.highlight.value)}</p>` +
      (o.highlight.sub
        ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${t.label}">${escapeHtml(o.highlight.sub)}</p>`
        : "") +
      `</td></tr></table>`;
  }

  let callout = "";
  if (o.callout) {
    const t = TONES[o.callout.tone];
    callout =
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:separate;margin:22px 0 0">` +
      `<tr><td style="background:${t.bg};border-left:3px solid ${t.border};border-radius:6px;padding:14px 16px">` +
      (o.callout.title
        ? `<p style="margin:0 0 4px;font-family:${FONT};font-size:13px;font-weight:700;color:${t.fg}">${escapeHtml(o.callout.title)}</p>`
        : "") +
      `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${t.fg}">${escapeHtml(o.callout.text)}</p>` +
      `</td></tr></table>`;
  }

  // A padded <a>, not a styled <button> or a VML rectangle: it degrades to a
  // plain link everywhere, and the URL is repeated below for the clients that
  // strip the styling entirely.
  const cta = o.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px"><tr>` +
      `<td style="background:${BRAND.accent};border-radius:8px">` +
      `<a href="${escapeHtml(o.cta.href)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(o.cta.label)}</a>` +
      `</td></tr></table>` +
      `<p style="margin:4px 0 0;font-family:${FONT};font-size:11px;line-height:17px;color:${BRAND.faint};word-break:break-all">Or open this link: ${escapeHtml(o.cta.href)}</p>`
    : "";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(o.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(o.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${BRAND.page}">
<tr><td align="center" style="padding:32px 12px">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:14px;overflow:hidden">

  <tr><td style="padding:22px 32px;border-bottom:1px solid ${BRAND.line};background:${BRAND.surface}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="34" height="34" style="background:${BRAND.accent};border-radius:8px;width:34px;height:34px;text-align:center;vertical-align:middle">
        <span style="font-family:${FONT};font-size:17px;font-weight:700;color:#ffffff;line-height:34px">A</span>
      </td>
      <td style="padding-left:11px;vertical-align:middle">
        <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${BRAND.ink};letter-spacing:-.01em">${BRAND.name}</div>
        <div style="font-family:${FONT};font-size:11px;color:${BRAND.faint};letter-spacing:.04em">${BRAND.product}</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:30px 32px 32px;background:${BRAND.surface}">
    <p style="margin:0 0 8px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${BRAND.accent}">${escapeHtml(o.eyebrow)}</p>
    <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:29px;font-weight:700;color:${BRAND.ink};letter-spacing:-.02em">${escapeHtml(o.heading)}</h1>
    ${o.greeting ? `<p style="margin:0 0 14px;font-family:${FONT};font-size:14px;line-height:22px;color:${BRAND.ink}">${escapeHtml(o.greeting)}</p>` : ""}
    ${paras(o.intro, BRAND.muted)}
    ${highlight}
    ${sections}
    ${callout}
    ${cta}
    ${o.outro?.length ? `<div style="height:10px;line-height:10px">&nbsp;</div>${paras(o.outro, BRAND.muted)}` : ""}
    ${o.signoff ? `<p style="margin:18px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${BRAND.ink}">${escapeHtml(o.signoff).replace(/\n/g, "<br>")}</p>` : ""}
  </td></tr>

  <tr><td style="padding:18px 32px 22px;background:${BRAND.subtle};border-top:1px solid ${BRAND.line}">
    <p style="margin:0 0 6px;font-family:${FONT};font-size:11px;line-height:17px;color:${BRAND.muted}">${escapeHtml(o.footerReason)}</p>
    <p style="margin:0;font-family:${FONT};font-size:11px;line-height:17px;color:${BRAND.faint}">&copy; ${new Date().getFullYear()} ${BRAND.name}. This message and any documents linked from it are confidential and intended only for the named recipient.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function renderText(o: EmailInput) {
  const out: string[] = [];
  out.push(BRAND.name.toUpperCase());
  out.push("=".repeat(BRAND.name.length));
  out.push("");
  out.push(o.heading);
  out.push("");
  if (o.greeting) {
    out.push(o.greeting);
    out.push("");
  }
  for (const p of o.intro ?? []) {
    out.push(p);
    out.push("");
  }
  if (o.highlight) {
    out.push(`${o.highlight.label}: ${o.highlight.value}`);
    if (o.highlight.sub) out.push(o.highlight.sub);
    out.push("");
  }
  for (const s of o.sections ?? []) {
    if (!s.rows.length) continue;
    if (s.title) {
      out.push(s.title.toUpperCase());
      out.push("-".repeat(s.title.length));
    }
    // Pad the labels so the block still reads as a table in a plain-text client.
    const width = Math.max(...s.rows.map(([k]) => k.length));
    for (const [k, v] of s.rows) out.push(`${k.padEnd(width)}  ${v}`);
    out.push("");
  }
  if (o.callout) {
    if (o.callout.title) out.push(o.callout.title.toUpperCase());
    out.push(o.callout.text);
    out.push("");
  }
  if (o.cta) {
    out.push(`${o.cta.label}: ${o.cta.href}`);
    out.push("");
  }
  for (const p of o.outro ?? []) {
    out.push(p);
    out.push("");
  }
  if (o.signoff) {
    out.push(o.signoff);
    out.push("");
  }
  out.push("--");
  out.push(o.footerReason);
  out.push(`(c) ${new Date().getFullYear()} ${BRAND.name}. Confidential.`);
  return out.join("\n");
}

export function renderEmail(o: EmailInput) {
  return { html: renderHtml(o), text: renderText(o) };
}

const OPS_FOOTER =
  "You are receiving this because your address is on the Aurum Operations alert list for this event type.";
const CUSTOMER_FOOTER =
  "You are receiving this because you are named on this booking with Aurum Real Estate. Please do not reply to this address — contact your sales representative for anything you need.";

// ---------------------------------------------------------------------------
// Internal operations mail
// ---------------------------------------------------------------------------

export function buildBookingEmail(d: BookingAlertData) {
  const others = (d.contacts ?? []).filter((c) => !c.isPrimary);
  return {
    subject: `Booking ${d.bookingRef} submitted for verification — ${d.project} / ${d.unit}`,
    ...renderEmail({
      preheader: `${d.submitterName} submitted ${d.bookingRef} for ${d.customerName}. Awaiting verification.`,
      eyebrow: "Verification required",
      heading: "A new booking is awaiting verification",
      intro: [
        `${d.submitterName} has submitted booking ${d.bookingRef} and it is now in the verification queue.`
      ],
      highlight: { label: "Total property value", value: money(d.totalValue), tone: "neutral" },
      sections: [
        {
          title: "Booking",
          rows: [
            ["Booking ID", d.bookingRef],
            ["Project", d.project],
            ["Unit", d.unit],
            ["Submitted by", d.submitterName],
            ["Submitted on", longDate(new Date().toISOString()) ?? "—"]
          ]
        },
        {
          title: "Customer",
          rows: [
            ["Primary buyer", d.customerName],
            ...(d.customerEmail ? ([["Email", d.customerEmail]] as Row[]) : []),
            ...(others.length
              ? ([["Also on this booking", others.map((c) => c.name).join(", ")]] as Row[])
              : [])
          ]
        }
      ],
      outro: ["Please review the attached Statement of Accounts PDF. No link is included."],
      footerReason: OPS_FOOTER
    })
  };
}

export function buildPaymentEmail(d: PaymentAlertData) {
  return {
    subject: `Payment of ${money(d.amount)} on ${d.bookingRef} awaiting verification`,
    ...renderEmail({
      preheader: `${d.submitterName} recorded ${money(d.amount)} against ${d.bookingRef}. Needs verification.`,
      eyebrow: "Verification required",
      heading: "A new payment needs verifying",
      intro: [
        `${d.submitterName} recorded a payment against booking ${d.bookingRef}. It will not be credited to the customer's balance until it is verified.`
      ],
      highlight: {
        label: "Amount recorded",
        value: money(d.amount),
        sub: modeLabel(d.mode),
        tone: "warning"
      },
      sections: [
        {
          title: "Payment",
          rows: [
            ["Booking ID", d.bookingRef],
            ["Customer", d.customerName],
            ["Payment mode", modeLabel(d.mode)],
            ...(d.reference ? ([["Reference / UTR", d.reference]] as Row[]) : []),
            ...(d.paymentDate
              ? ([["Payment date", longDate(d.paymentDate) ?? d.paymentDate]] as Row[])
              : []),
            ["Recorded by", d.submitterName]
          ]
        },
        {
          title: "Balance before this payment is credited",
          rows: [["Outstanding", money(d.remainingBalance)]]
        }
      ],
      outro: ["The updated Statement of Accounts PDF is attached. No link is included."],
      footerReason: OPS_FOOTER
    })
  };
}

export function buildWelcomeEmail(userName: string, userEmail: string, userRole: string, tempPassword?: string | null) {
  const href = appUrl();
  return {
    subject: `Your account has been created in AURUM`,
    ...renderEmail({
      preheader: `Your AURUM account is ready — ${userRole} access. Sign in now.`,
      eyebrow: "Account created",
      heading: `Your account has been created in AURUM`,
      greeting: `Hello ${firstName(userName)},`,
      intro: [
        `Your account on ${BRAND.name} (${BRAND.product}) has been created by your Director. You can sign in immediately.`
      ],
      highlight: tempPassword
        ? { label: "Temporary password", value: tempPassword, sub: "Use this once, then change it after first login", tone: "warning" as const }
        : undefined,
      sections: [
        {
          title: "Your account",
          rows: [
            ["Name", userName],
            ["Email", userEmail],
            ["Role", userRole],
            ...(tempPassword ? [["Sign-in method", "Email + temporary password (or Google if Workspace)"]] as Row[] : [])
          ]
        }
      ],
      cta: { href, label: "Sign in to AURUM" },
      callout: tempPassword
        ? {
            tone: "negative" as const,
            title: "Change this password after first login",
            text: "This temporary password is sent once by email. Change it in My Profile after you sign in, and do not forward this email."
          }
        : {
            tone: "warning" as const,
            title: "Keep this account to yourself",
            text: "Bookings and customer documents on this platform are confidential. Never share your sign-in details, and sign out on shared devices."
          },
      outro: ["If you were not expecting this, please contact your Director immediately."],
      footerReason:
        "You are receiving this because a Director created an account for this address in AURUM.",
      signoff: `— ${BRAND.name}`
    })
  };
}

// ---------------------------------------------------------------------------
// Customer-facing mail
//
// Every person linked to the booking through `booking_customers` receives
// these — the primary buyer and any co-buyer attached later — so each builder
// takes the recipient's own name rather than assuming the primary customer.
// The customer has no account, so /b/<uuid> is their only way back in.
// ---------------------------------------------------------------------------

function otherPartiesRow(
  d: { contacts?: { name: string; email: string }[] },
  recipientEmail?: string
): Row[] {
  const others = (d.contacts ?? []).filter((c) => c.email !== recipientEmail);
  return others.length ? [["Also on this booking", others.map((c) => c.name).join(", ")]] : [];
}

export function buildBookingCreatedEmail(
  d: BookingAlertData,
  recipientName?: string,
  recipientEmail?: string
) {
  return {
    subject: `Booking ${d.bookingRef} confirmed — ${d.project}, Unit ${d.unit}`,
    ...renderEmail({
      preheader: `We have registered your booking for ${d.project}, Unit ${d.unit}. Reference ${d.bookingRef}.`,
      eyebrow: "Booking registered",
      heading: "Your booking has been registered",
      greeting: `Dear ${firstName(recipientName ?? d.customerName)},`,
      intro: [
        `Thank you for choosing ${BRAND.name}. We have registered your booking and it is now with our accounts team for verification.`,
        `Please quote the reference below in all future correspondence.`
      ],
      highlight: {
        label: "Booking reference",
        value: d.bookingRef,
        sub: `${d.project} · Unit ${d.unit}`,
        tone: "neutral"
      },
      sections: [
        {
          title: "Property",
          rows: [
            ["Project", d.project],
            ["Unit", d.unit],
            ["Total consideration", money(d.totalValue)]
          ]
        },
        {
          title: "Booking",
          rows: [
            ["Booked on", longDate(new Date().toISOString()) ?? "—"],
            ["Registered by", d.submitterName],
            ["Current status", "Submitted for verification"],
            ...otherPartiesRow(d, recipientEmail)
          ]
        }
      ],
      callout: {
        tone: "neutral",
        title: "What happens next",
        text: "Our accounts team is verifying the details and documents submitted with this booking. Your statement of accounts is attached as PDF."
      },
      outro: [
        "The PDF attached contains your booking record, payments received, outstanding balance and schedule. Please keep it for your records."
      ],
      signoff: `With thanks,\n${BRAND.name}`,
      footerReason: CUSTOMER_FOOTER
    })
  };
}

/** Sent the moment a payment is recorded, before verification. */
export function buildPaymentReceivedCustomerEmail(
  d: PaymentAlertData,
  recipientName?: string,
  recipientEmail?: string
) {
  return {
    subject: `Payment of ${money(d.amount)} received against ${d.bookingRef}`,
    ...renderEmail({
      preheader: `We have recorded ${money(d.amount)} against booking ${d.bookingRef}. Verification is in progress.`,
      eyebrow: "Payment received",
      heading: "We have recorded your payment",
      greeting: `Dear ${firstName(recipientName ?? d.customerName)},`,
      intro: [
        `A payment against booking ${d.bookingRef} has been recorded on your account and passed to our accounts team for verification.`
      ],
      highlight: {
        label: "Amount recorded",
        value: money(d.amount),
        sub: modeLabel(d.mode),
        tone: "neutral"
      },
      sections: [
        {
          title: "Payment details",
          rows: [
            ["Booking reference", d.bookingRef],
            ["Payment mode", modeLabel(d.mode)],
            ...(d.reference ? ([["Reference / UTR", d.reference]] as Row[]) : []),
            ...(d.paymentDate
              ? ([["Payment date", longDate(d.paymentDate) ?? d.paymentDate]] as Row[])
              : []),
            ["Recorded by", d.submitterName],
            ["Status", "Pending verification"],
            ...otherPartiesRow(d, recipientEmail)
          ]
        }
      ],
      callout: {
        tone: "warning",
        title: "Not yet credited",
        text: "This amount is not reflected in your paid total until our accounts team verifies it. Your updated statement is attached."
      },
      outro: [
        "If you did not make this payment, please contact your sales representative immediately. The PDF statement is attached."
      ],
      signoff: `With thanks,\n${BRAND.name}`,
      footerReason: CUSTOMER_FOOTER
    })
  };
}

/** Sent when an accountant approves or rejects a payment. */
export function buildPaymentReviewedCustomerEmail(
  d: PaymentAlertData,
  recipientName?: string,
  recipientEmail?: string
) {
  const approved = d.decision === "APPROVED";
  const greeting = `Dear ${firstName(recipientName ?? d.customerName)},`;
  const others = otherPartiesRow(d, recipientEmail);

  if (approved) {
    const cleared = d.remainingBalance <= 0;
    return {
      subject: `Payment of ${money(d.amount)} verified — ${d.bookingRef}`,
      ...renderEmail({
        preheader: `${money(d.amount)} has been verified and credited to booking ${d.bookingRef}.`,
        eyebrow: "Payment verified",
        heading: "Your payment has been verified",
        greeting,
        intro: [
          `Our accounts team has verified your payment and credited it to booking ${d.bookingRef}.`
        ],
        highlight: {
          label: "Amount verified",
          value: money(d.amount),
          sub: modeLabel(d.mode),
          tone: "positive"
        },
        sections: [
          {
            title: "Payment details",
            rows: [
              ["Booking reference", d.bookingRef],
              ["Payment mode", modeLabel(d.mode)],
              ...(d.reference ? ([["Reference / UTR", d.reference]] as Row[]) : []),
              ...(d.paymentDate
                ? ([["Payment date", longDate(d.paymentDate) ?? d.paymentDate]] as Row[])
                : []),
              ["Verified by", d.reviewerName ?? d.submitterName],
              ...others
            ]
          },
          {
            title: "Account summary",
            rows: [
              ...(d.totalValue !== undefined
                ? ([["Total consideration", money(d.totalValue)]] as Row[])
                : []),
              ...(d.totalPaid !== undefined
                ? ([["Total paid to date", money(d.totalPaid)]] as Row[])
                : []),
              ["Outstanding balance", money(d.remainingBalance)]
            ]
          }
        ],
        callout: cleared
          ? {
              tone: "positive",
              title: "Your balance is now clear",
              text: "There is no outstanding amount on this booking. Your statement is attached."
            }
          : {
              tone: "neutral",
              title: "Outstanding balance",
              text: `${money(d.remainingBalance)} remains payable. Your updated statement is attached.`
            },
        outro: ["The PDF statement is attached for your records."],
        signoff: `With thanks,\n${BRAND.name}`,
        footerReason: CUSTOMER_FOOTER
      })
    };
  }

  return {
    subject: `Action needed: we could not verify your payment on ${d.bookingRef}`,
    ...renderEmail({
      preheader: `A payment of ${money(d.amount)} on ${d.bookingRef} could not be verified and has not been credited.`,
      eyebrow: "Action needed",
      heading: "We could not verify this payment",
      greeting,
      intro: [
        `Our accounts team was unable to verify a payment recorded against booking ${d.bookingRef}. It has not been credited to your balance.`
      ],
      highlight: {
        label: "Amount not credited",
        value: money(d.amount),
        sub: modeLabel(d.mode),
        tone: "negative"
      },
      sections: [
        {
          title: "Payment details",
          rows: [
            ["Booking reference", d.bookingRef],
            ["Payment mode", modeLabel(d.mode)],
            ...(d.reference ? ([["Reference / UTR", d.reference]] as Row[]) : []),
            ...(d.paymentDate
              ? ([["Payment date", longDate(d.paymentDate) ?? d.paymentDate]] as Row[])
              : []),
            ["Status", "Not verified"],
            ...others
          ]
        }
      ],
      callout: {
        tone: "negative",
        title: d.rejectionReason ? "Reason given" : "Next step",
        text: d.rejectionReason
          ? d.rejectionReason
          : "Please contact your sales representative with your payment reference so we can trace it."
      },
      outro: [
        "No action is needed on this email itself. Please speak to your sales representative."
      ],
      signoff: `With thanks,\n${BRAND.name}`,
      footerReason: CUSTOMER_FOOTER
    })
  };
}

// ---------------------------------------------------------------------------
// Overdue payment chaser — addressed to the employee who owns the booking
// ---------------------------------------------------------------------------

export function buildOverdueEmail(d: OverdueAlertData) {
  const weeks = Math.floor(d.daysOverdue / 7);
  const period =
    d.daysOverdue >= 60
      ? `${Math.floor(d.daysOverdue / 30)} months`
      : d.daysOverdue >= 30
        ? "over a month"
        : weeks <= 1
          ? "a week"
          : `${weeks} weeks`;
  const severe = d.daysOverdue >= 30;

  return {
    subject: `Payment outstanding for ${period} — ${d.bookingRef} (${money(d.remainingBalance)})`,
    ...renderEmail({
      preheader: `${d.bookingRef} still has ${money(d.remainingBalance)} outstanding after ${d.daysOverdue} days. Please follow up with ${d.customerName}.`,
      eyebrow: severe ? "Escalation" : "Follow-up required",
      heading: "A booking you own still has an outstanding balance",
      greeting: `Hello ${firstName(d.ownerName)},`,
      intro: [
        `Booking ${d.bookingRef} was created ${d.daysOverdue} days ago and the balance has not been settled. Please contact the customer and confirm when payment will be made.`
      ],
      highlight: {
        label: "Outstanding balance",
        value: money(d.remainingBalance),
        sub: `${money(d.totalPaid)} of ${money(d.totalValue)} received`,
        tone: severe ? "negative" : "warning"
      },
      sections: [
        {
          title: "Booking",
          rows: [
            ["Booking ID", d.bookingRef],
            ["Project", d.project],
            ["Unit", d.unit],
            ...(d.bookingDate
              ? ([["Booked on", longDate(d.bookingDate) ?? d.bookingDate]] as Row[])
              : []),
            ["Days outstanding", String(d.daysOverdue)],
            [
              "Last payment",
              d.lastPaymentDate ? (longDate(d.lastPaymentDate) ?? d.lastPaymentDate) : "None recorded"
            ]
          ]
        },
        {
          title: "Who to contact",
          rows: [
            ["Customer", d.customerName],
            ...(d.customerPhone ? ([["Phone", d.customerPhone]] as Row[]) : []),
            ...(d.customerEmail ? ([["Email", d.customerEmail]] as Row[]) : [])
          ]
        }
      ],
      callout: severe
        ? {
            tone: "negative",
            title: "This has been outstanding for over a month",
            text: "Please speak to the customer today and record the outcome as a note on the booking. If the customer is unreachable, raise a support ticket so the team can escalate."
          }
        : {
            tone: "warning",
            title: "What we need from you",
            text: "Call the customer, agree a payment date, and record the payment on the booking as soon as it is made. This reminder will repeat until the balance is cleared."
          },
      outro: [
        "Customer contact details are shown above for follow-up only. Do not forward this email outside the organisation. The Statement PDF is attached.",
        "No booking link is included in this email."
      ],
      signoff: `— ${BRAND.product}`,
      footerReason:
        "You are receiving this because you are the employee who created this booking on Aurum Operations."
    })
  };
}
