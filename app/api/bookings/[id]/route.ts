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

  const next: Record<string, any> = {
    project_name: projectName,
    unit_number: unitNumber,
    property_details: String(body.property_details ?? "").trim() || null,
    total_property_value: totalValue,
    notes: String(body.notes ?? "").trim() || null,
    booking_place: String(body.booking_place ?? "").trim() || null,
    booking_date: body.booking_date || null,
    block: String(body.block ?? "").trim() || null,
    facing: String(body.facing ?? "").trim() || null,
    sales_representative: body.sales_representative !== undefined ? String(body.sales_representative ?? "").trim() || null : current.sales_representative,
    team_manager: body.team_manager !== undefined ? String(body.team_manager ?? "").trim() || null : current.team_manager,
    saleable_area: body.saleable_area !== undefined && body.saleable_area !== "" && body.saleable_area !== null ? Number(body.saleable_area) : current.saleable_area,
    carpet_area: body.carpet_area !== undefined && body.carpet_area !== "" && body.carpet_area !== null ? Number(body.carpet_area) : current.carpet_area,
    external_walls_area: body.external_walls_area !== undefined && body.external_walls_area !== "" && body.external_walls_area !== null ? Number(body.external_walls_area) : current.external_walls_area,
    balcony_utility_area: body.balcony_utility_area !== undefined && body.balcony_utility_area !== "" && body.balcony_utility_area !== null ? Number(body.balcony_utility_area) : current.balcony_utility_area,
    common_area: body.common_area !== undefined && body.common_area !== "" && body.common_area !== null ? Number(body.common_area) : current.common_area,
    sale_consideration_per_sqft: body.sale_consideration_per_sqft !== undefined && body.sale_consideration_per_sqft !== "" && body.sale_consideration_per_sqft !== null ? Number(body.sale_consideration_per_sqft) : current.sale_consideration_per_sqft,
    source_of_booking: body.source_of_booking !== undefined ? String(body.source_of_booking ?? "").trim() || null : current.source_of_booking,
    payment_source: body.payment_source !== undefined ? String(body.payment_source ?? "").trim() || null : current.payment_source,
    purchase_purpose: body.purchase_purpose !== undefined ? String(body.purchase_purpose ?? "").trim() || null : current.purchase_purpose,
    cp_agent_name: body.cp_agent_name !== undefined ? String(body.cp_agent_name ?? "").trim() || null : current.cp_agent_name,
    cp_rera_id: body.cp_rera_id !== undefined ? String(body.cp_rera_id ?? "").trim() || null : current.cp_rera_id,
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
