import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { revokedResponse } from "@/lib/auth/session";
import { reportAccessAttempt } from "@/lib/security/access-alert";
import { resolveBookingContacts } from "@/lib/integrations/contacts";
import { enqueueDirectEmail } from "@/lib/integrations/outbound";
import { buildBookingCreatedEmail } from "@/lib/integrations/templates";
import { writeAudit } from "@/lib/utils/notifications";
import { isEmail } from "@/lib/integrations/phone";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("app_users").select("id, name, role, status").eq("id", user.id).maybeSingle();
  if (!profile) return revokedResponse();
  if (profile.status !== "APPROVED" || !["SM", "CP", "ADMIN", "DIRECTOR"].includes(profile.role)) {
    return NextResponse.json({ error: "Role not permitted." }, { status: 403 });
  }

  // Read with the service-role client so the ownership decision below is made
  // on the real row: the RLS-scoped read would return null for a colleague's
  // booking, which is indistinguishable from a booking that does not exist.
  const admin = createSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, booking_id, created_by, project_name, unit_number, total_property_value")
    .eq("id", id)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const isOversight = ["ADMIN", "DIRECTOR"].includes(profile.role);
  if (booking.created_by !== profile.id && !isOversight) {
    await reportAccessAttempt({
      actorId: profile.id,
      actorName: profile.name,
      actorRole: profile.role,
      resourceType: "booking",
      resourceId: booking.id,
      resourceLabel: booking.booking_id,
      ownerId: booking.created_by,
      action: "Tried to attach a person to another employee's booking",
      path: `/api/bookings/${id}/customers`
    });
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const email = String(body.email ?? "").trim().toLowerCase() || null;
  if (email && !isEmail(email)) {
    return NextResponse.json({ error: "That email address is not valid." }, { status: 400 });
  }

  const { data: customer, error: customerError } = await admin.from("customers").insert({
    title: body.title ?? null, name, father_spouse_name: body.father_spouse_name ?? null, date_of_birth: body.date_of_birth || null,
    address: body.address ?? null, city: body.city ?? null, state: body.state ?? null, country: body.country ?? null, pin_code: body.pin_code ?? null,
    phone: String(body.phone ?? "").trim() || null, alternate_phone: body.alternate_phone ?? null, email,
    alternate_email: body.alternate_email ?? null, pan_number: body.pan_number ?? null, aadhaar_number: body.aadhaar_number ?? null,
    occupation: body.occupation ?? null, organization: body.organization ?? null, designation: body.designation ?? null, created_by: user.id
  }).select("id").single();
  if (customerError) return NextResponse.json({ error: customerError.message }, { status: 500 });

  const { error } = await admin.from("booking_customers").insert({ booking_id: id, customer_id: customer.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    actorUserId: profile.id,
    actorRole: profile.role,
    action: "BOOKING_CUSTOMER_ATTACH",
    entityType: "booking",
    entityId: booking.id,
    newData: { customer_id: customer.id, name, email }
  });

  /**
   * Bring the newly attached person up to date.
   *
   * They were not on the booking when it was created, so they never received
   * the confirmation. Without this they would only start hearing from us at
   * the next payment, with no context for what the booking is. Contacts are
   * re-resolved after the insert so the "also on this booking" line lists
   * everyone, including the person we are writing to.
   */
  if (email) {
    try {
      const contacts = await resolveBookingContacts(booking.id);
      const mail = buildBookingCreatedEmail(
        {
          bookingRef: booking.booking_id,
          bookingUuid: booking.id,
          submitterName: profile.name,
          customerName: name,
          customerEmail: email,
          contacts,
          project: booking.project_name,
          unit: booking.unit_number,
          totalValue: Number(booking.total_property_value ?? 0)
        },
        name,
        email
      );
      await enqueueDirectEmail({
        eventKey: "BOOKING_CREATED_CUSTOMER",
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        entityType: "booking",
        entityId: booking.id,
        threadKey: `booking-${booking.id}`,
        dedupeKey: `BOOKING_CREATED_CUSTOMER:${booking.id}:EMAIL:${email}`
      });
    } catch (e) {
      // A failed welcome email must not undo a successful attachment.
      console.error("[bookings] attach-person email failed", e);
    }
  }

  return NextResponse.json({ ok: true, customer_id: customer.id });
}
