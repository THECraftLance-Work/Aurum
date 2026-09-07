import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueOutbound } from "@/lib/integrations/outbound";
import { sendNotification } from "@/lib/utils/notifications";
import { formatINR } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Overdue-payment sweep.
 *
 * A booking whose balance has not moved in a week is a booking nobody is
 * chasing. This runs once a day and pushes the ones that have gone quiet back
 * at the employee who created them, by in-app notification and by email, with
 * the customer's phone number in the message so following up is one tap.
 *
 * Escalation, driven entirely by age:
 *   - week 1 to 4 : a reminder every 7 days   (stage W1, W2, W3, W4)
 *   - month 2 on  : a reminder every 30 days  (stage M2, M3, …)
 *
 * The stage string is part of the delivery row's dedupe key, so running this
 * twice in a day sends nothing the second time, while next week's stage still
 * goes out. That is what makes the endpoint safe to re-run by hand.
 */

/** Bookings younger than this are simply in progress, not overdue. */
const FIRST_REMINDER_DAYS = 7;

/** Anything still open after this many days is treated as abandoned, not chased. */
const MAX_CHASE_DAYS = 365;

/** Only these are live enough to chase. A rejected booking owes nothing. */
const CHASEABLE = ["SUBMITTED", "UNDER_REVIEW", "UPDATED", "APPROVED"];

function stageFor(days: number): string | null {
  if (days < FIRST_REMINDER_DAYS) return null;
  if (days < 30) return `W${Math.floor(days / 7)}`;
  return `M${Math.floor(days / 30) + 1}`;
}

function daysBetween(from: string, to: Date) {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.floor((to.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. A signed-in Director
 * may also trigger a sweep by hand, which is useful when testing and when a
 * scheduled run has been missed.
 */
async function authorize(req: Request): Promise<{ ok: true } | { ok: false; status: number }> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return { ok: true };

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };
  const { data: profile } = await supabase
    .from("app_users").select("role, status").eq("id", user.id).maybeSingle();
  if (profile?.status === "APPROVED" && ["ADMIN", "DIRECTOR"].includes(profile.role)) {
    return { ok: true };
  }
  return { ok: false, status: 403 };
}

export async function GET(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const now = new Date();
  const cutoff = new Date(now.getTime() - FIRST_REMINDER_DAYS * 86_400_000).toISOString();
  const admin = createSupabaseAdmin();

  const { data: bookings, error } = await admin
    .from("bookings")
    .select(
      "id, booking_id, project_name, unit_number, booking_date, created_at, created_by, total_property_value, total_amount_paid, remaining_balance, status, customer:customer_id(name, phone, email)"
    )
    .in("status", CHASEABLE)
    .gt("remaining_balance", 0)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[cron/payment-reminders] query failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = bookings ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ scanned: 0, notified: 0, skipped: 0 });
  }

  // One batched lookup for the owners rather than one per booking.
  const ownerIds = [...new Set(rows.map((b: any) => b.created_by).filter(Boolean))];
  const { data: owners } = await admin
    .from("app_users")
    .select("id, name, email, status")
    .in("id", ownerIds);
  const ownerById = new Map((owners ?? []).map((o: any) => [o.id, o]));

  // Latest payment per booking, in one query, so the email can say how long it
  // has actually been since money last moved.
  const { data: lastPayments } = await admin
    .from("payments")
    .select("booking_id, payment_date, created_at")
    .in("booking_id", rows.map((b: any) => b.id))
    .eq("status", "APPROVED")
    .order("payment_date", { ascending: false });
  const lastPaymentByBooking = new Map<string, string>();
  for (const p of lastPayments ?? []) {
    if (!lastPaymentByBooking.has(p.booking_id)) {
      lastPaymentByBooking.set(p.booking_id, p.payment_date ?? p.created_at);
    }
  }

  let notified = 0;
  let skipped = 0;

  for (const b of rows as any[]) {
    const owner = ownerById.get(b.created_by);
    // No owner, a disabled owner, or no address: nobody to chase.
    if (!owner || owner.status !== "APPROVED" || !owner.email) {
      skipped++;
      continue;
    }

    const since = b.booking_date || b.created_at;
    const days = daysBetween(since, now);
    if (days > MAX_CHASE_DAYS) {
      skipped++;
      continue;
    }
    const stage = stageFor(days);
    if (!stage) {
      skipped++;
      continue;
    }

    const customer: any = Array.isArray(b.customer) ? b.customer[0] : b.customer;

    // enqueueOutbound is the deduplicating step: it returns no ids when this
    // booking has already been chased at this stage. The in-app notification
    // is gated on that same result, so the two can never disagree.
    const { ids } = await enqueueOutbound({
      key: "PAYMENT_OVERDUE",
      entityId: b.id,
      data: {
        bookingRef: b.booking_id,
        bookingUuid: b.id,
        ownerName: owner.name,
        ownerEmail: owner.email,
        project: b.project_name,
        unit: b.unit_number,
        customerName: customer?.name ?? "the customer",
        customerPhone: customer?.phone ?? null,
        customerEmail: customer?.email ?? null,
        totalValue: Number(b.total_property_value ?? 0),
        totalPaid: Number(b.total_amount_paid ?? 0),
        remainingBalance: Number(b.remaining_balance ?? 0),
        daysOverdue: days,
        bookingDate: b.booking_date ?? b.created_at ?? null,
        lastPaymentDate: lastPaymentByBooking.get(b.id) ?? null,
        stage
      }
    });

    if (ids.length === 0) {
      skipped++;
      continue;
    }

    await sendNotification({
      recipientUserId: owner.id,
      category: "PAYMENT",
      title: "Payment still outstanding",
      message: `${b.booking_id} has ${formatINR(b.remaining_balance)} outstanding after ${days} days. Contact ${customer?.name ?? "the customer"}${customer?.phone ? ` on ${customer.phone}` : ""}.`,
      entityType: "booking",
      entityId: b.id,
      priority: days >= 30 ? "URGENT" : "HIGH"
    });
    notified++;
  }

  return NextResponse.json({ scanned: rows.length, notified, skipped });
}

/** Some schedulers only issue POST. Same job either way. */
export const POST = GET;
