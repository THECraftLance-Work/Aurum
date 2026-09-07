import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueDirectEmail } from "@/lib/integrations/outbound";
import { renderEmail } from "@/lib/integrations/templates";
import { appUrl } from "@/lib/integrations/env";

export type AccessAttempt = {
  actorId: string;
  actorName: string;
  actorRole: string;
  /** What kind of record was reached for: "booking", "payment", "employee"… */
  resourceType: string;
  resourceId: string;
  /** Human-readable identifier, e.g. the booking reference. */
  resourceLabel?: string | null;
  /** Employee the record belongs to, when known. */
  ownerId?: string | null;
  /** One line describing what was attempted. */
  action: string;
  /** Route or page the attempt came through. */
  path: string;
};

/**
 * How often one actor can trigger a Director *email*. In-app notifications are
 * never throttled — a Director should see every attempt in the inbox — but a
 * script hammering booking UUIDs must not turn into a thousand emails, which
 * would bury the signal and burn the daily SMTP quota.
 */
const EMAIL_THROTTLE_MS = 15 * 60 * 1000;

/**
 * Record a cross-employee access attempt and alert every Director.
 *
 * Called from the deny path of a route or page — never from the allow path.
 * It is deliberately fire-and-forget in effect: it swallows every error, so a
 * failure here can never change the HTTP status the caller is about to return.
 * The caller must still return its 403/404 regardless of what happens in here.
 *
 * Three things happen, in order of how much we care about them surviving:
 *   1. An `audit_logs` row. This is the permanent record and the one thing
 *      that must not be lost.
 *   2. An in-app notification to every approved Director, priority URGENT.
 *   3. An email to every approved Director, throttled per actor.
 */
export async function reportAccessAttempt(attempt: AccessAttempt): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    const at = new Date();
    const label = attempt.resourceLabel || attempt.resourceId.slice(0, 8);

    // 1. Permanent record.
    await admin.from("audit_logs").insert({
      actor_user_id: attempt.actorId,
      actor_role: attempt.actorRole,
      action: "ACCESS_DENIED",
      entity_type: attempt.resourceType,
      entity_id: attempt.resourceId,
      new_data: {
        attempted: attempt.action,
        path: attempt.path,
        resource_label: attempt.resourceLabel ?? null,
        owner_user_id: attempt.ownerId ?? null
      },
      reason: attempt.action
    });

    const { data: directors } = await admin
      .from("app_users")
      .select("id, name, email")
      .eq("role", "DIRECTOR")
      .eq("status", "APPROVED");

    if (!directors?.length) return;

    // Owner name, for the alert copy. Best-effort — a missing name must not
    // stop the alert going out.
    let ownerName: string | null = null;
    if (attempt.ownerId) {
      const { data: owner } = await admin
        .from("app_users")
        .select("name")
        .eq("id", attempt.ownerId)
        .maybeSingle();
      ownerName = owner?.name ?? null;
    }

    // 2. In-app, always.
    await admin.from("notifications").insert(
      directors.map((d) => ({
        recipient_user_id: d.id,
        category: "IMPORTANT",
        title: "Unauthorised access attempt",
        message: `${attempt.actorName} (${attempt.actorRole}) ${lowerFirst(attempt.action)} — ${attempt.resourceType} ${label}${ownerName ? `, owned by ${ownerName}` : ""}.`,
        entity_type: attempt.resourceType,
        entity_id: attempt.resourceId,
        priority: "URGENT"
      }))
    );

    // 3. Email, throttled per actor per 15-minute bucket. The bucket is part
    // of the dedupe key, so the throttle costs no extra query — the unique
    // index on dedupe_key does the work.
    const bucket = Math.floor(at.getTime() / EMAIL_THROTTLE_MS);
    const mail = buildSecurityAlertEmail(attempt, ownerName, at);

    await Promise.all(
      directors
        .filter((d) => d.email)
        .map((d) =>
          enqueueDirectEmail({
            eventKey: "SECURITY_ACCESS_DENIED",
            to: d.email!,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            entityType: attempt.resourceType,
            entityId: attempt.resourceId,
            dedupeKey: `SECURITY_ACCESS_DENIED:${attempt.actorId}:${bucket}:EMAIL:${d.email!.toLowerCase()}`
          })
        )
    );
  } catch (e) {
    // An alerting failure must never surface to the user or change the
    // response. It is logged and nothing else.
    console.error("[security] access alert failed", e);
  }
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function buildSecurityAlertEmail(a: AccessAttempt, ownerName: string | null, at: Date) {
  const label = a.resourceLabel || a.resourceId;
  return {
    subject: `Security alert: ${a.actorName} attempted to access ${a.resourceType} ${label}`,
    ...renderEmail({
      preheader: `${a.actorName} (${a.actorRole}) was blocked from ${a.resourceType} ${label}${ownerName ? ` owned by ${ownerName}` : ""}.`,
      eyebrow: "Security alert",
      heading: "An employee tried to open a record that is not theirs",
      intro: [
        `The request was blocked and no data was returned. This notice is for your awareness so you can decide whether it needs following up.`
      ],
      highlight: {
        label: "Blocked",
        value: a.actorName,
        sub: `${a.actorRole} · ${lowerFirst(a.action)}`,
        tone: "negative"
      },
      sections: [
        {
          title: "What was attempted",
          rows: [
            ["Action", a.action],
            ["Record type", a.resourceType],
            ["Record", label],
            ...(ownerName ? ([["Belongs to", ownerName]] as [string, string][]) : []),
            ["Route", a.path],
            [
              "When",
              at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
            ]
          ]
        },
        {
          title: "Who attempted it",
          rows: [
            ["Employee", a.actorName],
            ["Role", a.actorRole],
            ["User ID", a.actorId]
          ]
        }
      ],
      callout: {
        tone: "warning",
        title: "Repeated attempts are throttled",
        text: "To avoid flooding your inbox, further email alerts about this employee are suppressed for 15 minutes. Every attempt is still recorded in the audit log and in your in-app inbox."
      },
      cta: { href: `${appUrl()}/audit`, label: "Open the audit log" },
      footerReason:
        "You are receiving this because you are a Director on Aurum Operations and access alerts are sent to all Directors.",
      signoff: "— Aurum Operations"
    })
  };
}

/**
 * Turn a "not found" into an intrusion alert when the record actually exists.
 *
 * Detail pages read through the RLS-scoped client, so a Sales Manager opening
 * a colleague's booking URL gets `null` back — indistinguishable, at the call
 * site, from a booking that was deleted or a mistyped URL. This re-reads with
 * the service-role client on the miss path only: if the row is really there
 * and belongs to someone else, it was a cross-employee access attempt and the
 * Directors are told. If the row does not exist, nothing happens.
 *
 * Costs one extra query, and only on the miss path, so the normal case is
 * unaffected.
 */
export async function reportMissedRecordAccess(opts: {
  table: "bookings" | "payments";
  recordId: string;
  actor: { id: string; name: string; role: string };
  path: string;
}): Promise<void> {
  // Reviewers can already see everything, so a miss for them is a genuine
  // miss, not a boundary being tested.
  if (["ACCOUNTANT", "ADMIN", "DIRECTOR"].includes(opts.actor.role)) return;

  try {
    const admin = createSupabaseAdmin();

    if (opts.table === "bookings") {
      const { data } = await admin
        .from("bookings")
        .select("id, booking_id, created_by")
        .eq("id", opts.recordId)
        .maybeSingle();
      if (!data || data.created_by === opts.actor.id) return;
      await reportAccessAttempt({
        actorId: opts.actor.id,
        actorName: opts.actor.name,
        actorRole: opts.actor.role,
        resourceType: "booking",
        resourceId: data.id,
        resourceLabel: data.booking_id,
        ownerId: data.created_by,
        action: "Opened another employee's booking record",
        path: opts.path
      });
      return;
    }

    const { data } = await admin
      .from("payments")
      .select("id, submitted_by, booking:booking_id(booking_id)")
      .eq("id", opts.recordId)
      .maybeSingle();
    if (!data || data.submitted_by === opts.actor.id) return;
    const bk: any = Array.isArray((data as any).booking)
      ? (data as any).booking[0]
      : (data as any).booking;
    await reportAccessAttempt({
      actorId: opts.actor.id,
      actorName: opts.actor.name,
      actorRole: opts.actor.role,
      resourceType: "payment",
      resourceId: data.id,
      resourceLabel: bk?.booking_id ?? null,
      ownerId: data.submitted_by,
      action: "Opened another employee's payment record",
      path: opts.path
    });
  } catch (e) {
    console.error("[security] miss check failed", e);
  }
}
