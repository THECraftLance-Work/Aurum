import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification, writeAudit } from "@/lib/utils/notifications";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "APPROVED" || !["ACCOUNTANT","ADMIN","DIRECTOR"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { decision, reason } = await req.json();
  if (!["APPROVED","REJECTED"].includes(decision)) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  if (decision === "REJECTED" && !reason) return NextResponse.json({ error: "Reason required" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: bk } = await admin.from("bookings").select("id, booking_id, created_by, status").eq("id", params.id).maybeSingle();
  if (!bk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await admin.from("bookings").update({
    status: decision,
    reviewed_by: profile.id,
    approved_at: decision === "APPROVED" ? new Date().toISOString() : null,
    rejection_reason: decision === "REJECTED" ? reason : null,
    updated_at: new Date().toISOString()
  }).eq("id", bk.id);

  // Approve pending payments alongside if booking approved
  if (decision === "APPROVED") {
    await admin.from("payments").update({
      status: "APPROVED", reviewed_by: profile.id, reviewed_at: new Date().toISOString()
    }).eq("booking_id", bk.id).eq("status", "PENDING");
  }

  await sendNotification({
    recipientUserId: bk.created_by,
    category: decision === "APPROVED" ? "APPROVAL" : "REJECTION",
    title: decision === "APPROVED" ? "Booking approved" : "Booking rejected",
    message: decision === "APPROVED"
      ? `Booking ${bk.booking_id} has been approved by ${profile.name}.`
      : `Booking ${bk.booking_id} was rejected. Reason: ${reason}`,
    entityType: "booking",
    entityId: bk.id,
    priority: "HIGH"
  });

  await writeAudit({
    actorUserId: profile.id, actorRole: profile.role,
    action: decision === "APPROVED" ? "BOOKING_APPROVE" : "BOOKING_REJECT",
    entityType: "booking", entityId: bk.id, reason: reason ?? undefined,
    oldData: { status: bk.status }, newData: { status: decision }
  });

  return NextResponse.json({ ok: true });
}
