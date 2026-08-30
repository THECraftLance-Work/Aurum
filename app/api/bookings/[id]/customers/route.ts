import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("app_users").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "APPROVED" || !["SM", "CP", "ADMIN", "DIRECTOR"].includes(profile.role)) {
    return NextResponse.json({ error: "Role not permitted." }, { status: 403 });
  }

  const { data: booking } = await supabase.from("bookings").select("id, created_by").eq("id", id).maybeSingle();
  if (!booking || (booking.created_by !== user.id && !["ADMIN", "DIRECTOR"].includes(profile.role))) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: customer, error: customerError } = await admin.from("customers").insert({
    title: body.title ?? null, name, father_spouse_name: body.father_spouse_name ?? null, date_of_birth: body.date_of_birth || null,
    address: body.address ?? null, city: body.city ?? null, state: body.state ?? null, country: body.country ?? null, pin_code: body.pin_code ?? null,
    phone: String(body.phone ?? "").trim() || null, alternate_phone: body.alternate_phone ?? null, email: String(body.email ?? "").trim() || null,
    alternate_email: body.alternate_email ?? null, pan_number: body.pan_number ?? null, aadhaar_number: body.aadhaar_number ?? null,
    occupation: body.occupation ?? null, organization: body.organization ?? null, designation: body.designation ?? null, created_by: user.id
  }).select("id").single();
  if (customerError) return NextResponse.json({ error: customerError.message }, { status: 500 });

  const { error } = await admin.from("booking_customers").insert({ booking_id: id, customer_id: customer.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customer_id: customer.id });
}
