import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification, writeAudit } from "@/lib/utils/notifications";
import { formatINR } from "@/lib/utils/format";
import { dispatchOutbound } from "@/lib/integrations/outbound";

const Body = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(2000).nullish()
});

/**
 * Approve or reject a SINGLE payment.
 *
 * This did not exist before, and its absence was a data-integrity bug: the only
 * place a payment's status could change was the booking review, which
 * bulk-approves pending payments when the *booking* is approved. So the second
 * and later payments on an already-approved booking were stranded in PENDING
 * forever — invisible to the verification queue (which lists bookings by
 * booking status) and therefore never counted toward total_amount_paid, since
 * the recalc trigger only sums APPROVED rows. The booking's remaining balance
 * was silently wrong.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "APPROVED" || !["ACCOUNTANT", "ADMIN", "DIRECTOR"].includes(profile.role)) {
    return NextResponse.json({ error: "You do not have permission to verify payments." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { decision } = parsed.data;
  const reason = parsed.data.reason?.trim() || null;

  if (decision === "REJECTED" && !reason) {
    return NextResponse.json({ error: "A reason is required when rejecting a payment." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data: pay } = await admin
    .from("payments")
    .select("id, amount, status, payment_mode, reference_no, payment_date, submitted_by, booking_id, booking:booking_id(id, booking_id, total_property_value, total_amount_paid, customer:customer_id(name, email))")
    .eq("id", params.id)
    .maybeSingle();

  if (!pay) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  // Terminal states are final — re-deciding would silently move money.
  if (pay.status === "APPROVED" || pay.status === "REJECTED") {
    return NextResponse.json(
      { error: `This payment was already ${pay.status.toLowerCase()}.` },
      { status: 409 }
    );
  }

  const booking: any = Array.isArray(pay.booking) ? pay.booking[0] : pay.booking;

  // Approving must not push total paid past the property value. The recalc
  // trigger has no such guard, so it is enforced here.
  if (decision === "APPROVED") {
    const alreadyPaid = Number(booking?.total_amount_paid ?? 0);
    const total = Number(booking?.total_property_value ?? 0);
    if (alreadyPaid + Number(pay.amount) > total) {
      return NextResponse.json(
        {
          error: `Approving this would take total paid to ${formatINR(alreadyPaid + Number(pay.amount))}, above the property value of ${formatINR(total)}.`
        },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("payments")
    .update({
      status: decision,
      reviewed_by: profile.id,
      reviewed_at: now,
      rejection_reason: decision === "REJECTED" ? reason : null,
      updated_at: now
    })
    .eq("id", pay.id)
    // Compare-and-set: a concurrent reviewer can't double-apply the decision.
    .in("status", ["PENDING", "UNDER_REVIEW"]);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const ref = booking?.booking_id ?? "this booking";
  await sendNotification({
    recipientUserId: pay.submitted_by,
    category: decision === "APPROVED" ? "APPROVAL" : "REJECTION",
    title: decision === "APPROVED" ? "Payment approved" : "Payment rejected",
    message: decision === "APPROVED"
      ? `Your payment of ${formatINR(pay.amount)} on ${ref} was approved by ${profile.name}.`
      : `Your payment of ${formatINR(pay.amount)} on ${ref} was rejected. Reason: ${reason}`,
    entityType: "payment",
    entityId: pay.id,
    priority: "HIGH"
  });

  await writeAudit({
    actorUserId: profile.id,
    actorRole: profile.role,
    action: decision === "APPROVED" ? "PAYMENT_APPROVE" : "PAYMENT_REJECT",
    entityType: "payment",
    entityId: pay.id,
    oldData: { status: pay.status },
    newData: { status: decision, amount: pay.amount },
    reason: reason ?? undefined
  });

  // Email the customer. They have no account, so this is their only channel —
  // and until now they heard nothing after the booking-created email, so a
  // verified or rejected payment was invisible to them.
  const cust: any = booking?.customer
    ? (Array.isArray(booking.customer) ? booking.customer[0] : booking.customer)
    : null;

  const approvedTotal = Number(booking?.total_amount_paid ?? 0) + (decision === "APPROVED" ? Number(pay.amount) : 0);

  await dispatchOutbound({
    key: "PAYMENT_REVIEWED",
    entityId: pay.id,
    data: {
      bookingRef: booking?.booking_id ?? "",
      bookingUuid: booking?.id ?? pay.booking_id,
      submitterName: profile.name,
      customerName: cust?.name ?? "—",
      customerEmail: cust?.email ?? null,
      amount: Number(pay.amount),
      mode: pay.payment_mode,
      reference: pay.reference_no ?? null,
      paymentDate: pay.payment_date ?? null,
      decision,
      reviewerName: profile.name,
      rejectionReason: reason,
      totalPaid: approvedTotal,
      totalValue: Number(booking?.total_property_value ?? 0),
      remainingBalance: Math.max(0, Number(booking?.total_property_value ?? 0) - approvedTotal)
    }
  });

  return NextResponse.json({ ok: true, status: decision });
}
