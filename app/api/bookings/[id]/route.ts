import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification, writeAudit } from "@/lib/utils/notifications";

const EDIT_ROLES = ["ACCOUNTANT", "ADMIN", "DIRECTOR"];
const EDITABLE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "UPDATED"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase.from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!actor || actor.status !== "APPROVED" || !EDIT_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Only verification staff can correct bookings." }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data: current } = await admin.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!EDITABLE_STATUSES.includes(current.status)) {
    return NextResponse.json({ error: "Approved or rejected bookings cannot be edited here." }, { status: 409 });
  }

  const body = await req.json();
  const projectName = String(body.project_name ?? "").trim();
  const unitNumber = String(body.unit_number ?? "").trim();
  const totalValue = Number(body.total_property_value);
  if (!projectName || !unitNumber || !Number.isFinite(totalValue) || totalValue <= 0) {
    return NextResponse.json({ error: "Project, unit, and a valid total value are required." }, { status: 400 });
  }
  if (Number(current.total_amount_paid ?? 0) > totalValue) {
    return NextResponse.json({ error: "Total value cannot be lower than approved payments." }, { status: 400 });
  }

  const next = {
    project_name: projectName,
    unit_number: unitNumber,
    property_details: String(body.property_details ?? "").trim() || null,
    total_property_value: totalValue,
    notes: String(body.notes ?? "").trim() || null,
    booking_place: String(body.booking_place ?? "").trim() || null,
    booking_date: body.booking_date || null,
    block: String(body.block ?? "").trim() || null,
    facing: String(body.facing ?? "").trim() || null,
    status: "UPDATED",
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("bookings").update(next).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendNotification({
    recipientUserId: current.created_by,
    category: "BOOKING",
    title: "Booking updated for verification",
    message: `Booking ${current.booking_id} was corrected by ${actor.name} and needs verification again.`,
    entityType: "booking", entityId: id, priority: "HIGH",
  });
  await writeAudit({
    actorUserId: actor.id, actorRole: actor.role, action: "BOOKING_UPDATE",
    entityType: "booking", entityId: id, oldData: { project_name: current.project_name, unit_number: current.unit_number, total_property_value: current.total_property_value },
    newData: { project_name: projectName, unit_number: unitNumber, total_property_value: totalValue },
  });
  return NextResponse.json({ ok: true });
}
