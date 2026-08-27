import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { notifyRole, writeAudit } from "@/lib/utils/notifications";
import { dispatchOutbound } from "@/lib/integrations/outbound";

export async function POST(req: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "APPROVED") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { booking_id, amount, payment_date, payment_mode, reference_no, attachment } = await req.json();
  if (!booking_id || !amount || !payment_date || !payment_mode) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: bk } = await admin
    .from("bookings")
    .select("id, booking_id, remaining_balance, customer:customer_id(name)")
    .eq("id", booking_id)
    .maybeSingle();
  if (!bk) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (Number(amount) > Number(bk.remaining_balance)) return NextResponse.json({ error: "Exceeds remaining balance" }, { status: 400 });

  // Idempotency guard: reject if an identical payment was inserted in the last 15 seconds
  // (prevents double-POST from double-click or React StrictMode)
  const cutoff = new Date(Date.now() - 15_000).toISOString();
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("booking_id", booking_id)
    .eq("submitted_by", profile.id)
    .eq("amount", amount)
    .eq("payment_mode", payment_mode)
    .gte("created_at", cutoff)
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id, duplicate: true });

  const { data: p, error } = await admin.from("payments").insert({
    booking_id,
    amount,
    payment_date,
    payment_mode,
    reference_no,
    status: "PENDING",
    submitted_by: profile.id
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Link the uploaded receipt. Previously the client posted `document_proof`
  // and this route never destructured it, so every payment receipt was
  // silently discarded.
  if (attachment?.storagePath) {
    const { error: attErr } = await admin.from("attachments").insert({
      entity_type: "payment",
      entity_id: p.id,
      storage_path: attachment.storagePath,
      file_name: attachment.name ?? "receipt",
      file_size: Number(attachment.size ?? 0) || 1,
      mime_type: attachment.type ?? "application/octet-stream",
      label: "Payment receipt",
      uploaded_by: profile.id
    });
    if (attErr) console.error("[payments] attachment link failed", attErr.message);
  }

  await notifyRole("ACCOUNTANT", {
    category: "PAYMENT",
    title: "New payment for review",
    message: `Payment of ₹${Number(amount).toLocaleString("en-IN")} added on ${bk.booking_id}.`,
    entityType: "booking",
    entityId: bk.id,
    priority: "HIGH"
  });
  await writeAudit({
    actorUserId: profile.id, actorRole: profile.role,
    action: "PAYMENT_CREATE", entityType: "payment", entityId: p.id,
    newData: { booking_id, amount, payment_mode }
  });

  // Outbound bridge. Sits AFTER the idempotency guard above on purpose — a
  // deduped double-POST returns early and must not re-notify.
  await dispatchOutbound({
    key: "PAYMENT_ADDED",
    entityId: p.id,
    data: {
      bookingRef: bk.booking_id,
      bookingUuid: bk.id,
      submitterName: profile.name,
      customerName: (bk as any).customer?.name ?? "—",
      amount: Number(amount),
      mode: payment_mode,
      // Payment lands as PENDING, so the booking's balance is unchanged until
      // an accountant approves it.
      remainingBalance: Number(bk.remaining_balance)
    }
  });

  return NextResponse.json({ id: p.id });
}
