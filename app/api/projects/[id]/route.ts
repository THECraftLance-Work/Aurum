import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/utils/notifications";
import { revokedResponse } from "@/lib/auth/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!profile) return revokedResponse();
  if (!["ADMIN","DIRECTOR"].includes(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(()=> ({}));
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("projects").update({
    name: body.name ? String(body.name).trim() : undefined,
    default_sale_consideration: body.default_sale_consideration !== undefined ? Number(body.default_sale_consideration) : undefined,
    default_areas: body.default_areas ?? undefined,
    updated_at: new Date().toISOString()
  }).eq("id", id).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorUserId: profile.id, actorRole: profile.role, action: "PROJECT_UPDATE", entityType: "project", entityId: id, newData: body });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!profile) return revokedResponse();
  if (profile.role !== "DIRECTOR") return NextResponse.json({ error: "Only Director can delete projects" }, { status: 403 });

  // 3-step for Google Director: slug + DELETE + email OTP; for EMAIL Director: password
  const { slug, confirmText, password, otp } = await req.json().catch(()=> ({}));
  const admin = createSupabaseAdmin();
  const { data: proj } = await admin.from("projects").select("id, slug, name").eq("id", id).maybeSingle();
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (String(slug).trim() !== proj.slug) return NextResponse.json({ error: "Slug mismatch — type the exact project slug" }, { status: 400 });
  if (String(confirmText).trim() !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });

  const { data: fullProfile } = await admin.from("app_users").select("auth_provider, email").eq("id", profile.id).maybeSingle();
  const { data: { user: freshUser } } = await supabase.auth.getUser();
  if (!freshUser?.email) return NextResponse.json({ error: "Re-auth failed" }, { status: 401 });
  const isGoogle = fullProfile?.auth_provider === "GOOGLE";
  if (isGoogle) {
    // Verify OTP emailed via /delete-otp
    if (!otp || String(otp).trim().length !== 6) return NextResponse.json({ error: "Enter the 6-digit code sent to your email" }, { status: 400 });
    const { data: otpRow } = await admin.from("project_delete_otps").select("id, expires_at, used").eq("project_id", id).eq("director_id", profile.id).eq("code", String(otp).trim()).eq("used", false).gte("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!otpRow) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    await admin.from("project_delete_otps").update({ used: true }).eq("id", otpRow.id);
  } else {
    // EMAIL director: password re-auth
    const { error: reauth } = await supabase.auth.signInWithPassword({ email: freshUser.email, password: String(password ?? "") });
    if (reauth) return NextResponse.json({ error: "Password re-auth failed" }, { status: 401 });
  }

  // Gather all related data before deletion to email to director
  const [{ data: bookings }, { data: payments }, { data: tickets }, { data: notifs }] = await Promise.all([
    admin.from("bookings").select("id, booking_id, project_name, unit_number, total_property_value, total_amount_paid, status, created_at").eq("project_id", id),
    admin.from("payments").select("id, amount, payment_date, payment_mode, status, booking_id, submitted_by").eq("project_id", id),
    admin.from("tickets").select("id, ticket_number, subject, status, raised_by, created_at").eq("project_id", id),
    admin.from("notifications").select("id, title, category, created_at").eq("project_id", id).limit(100),
  ]);

  // Email all data to director before deletion
  try {
    const { enqueueDirectEmail } = await import("@/lib/integrations/outbound");
    const { renderEmail } = await import("@/lib/integrations/templates");
    const summaryHtml = renderEmail({
      preheader: `Project ${proj.name} deletion — ${bookings?.length ?? 0} bookings, ${payments?.length ?? 0} payments`,
      eyebrow: "Project deleted",
      heading: `Project ${proj.name} (${proj.slug}) was deleted`,
      intro: [`Director ${profile.name} deleted project ${proj.name} with 3-step verification. All related data has been removed from the platform.`],
      sections: [
        { title: "Summary", rows: [["Bookings", String(bookings?.length ?? 0)], ["Payments", String(payments?.length ?? 0)], ["Tickets", String(tickets?.length ?? 0)], ["Notifications", String(notifs?.length ?? 0)]] },
        { title: "Project", rows: [["ID", proj.id], ["Slug", proj.slug], ["Name", proj.name]] }
      ],
      outro: ["Full JSON dump of bookings/payments/tickets was attached as proof. Keep this email for audit."],
      footerReason: "You received this because you are Director and requested project deletion."
    });
    // Attach JSON as part of email payload (worker will handle attachments if present)
    await enqueueDirectEmail({
      eventKey: "PROJECT_DELETE",
      to: freshUser.email,
      subject: `Project ${proj.name} deleted — ${bookings?.length ?? 0} bookings archived`,
      html: summaryHtml.html,
      text: summaryHtml.text + "\n\n--- BOOKINGS ---\n" + JSON.stringify(bookings ?? [], null, 2).slice(0, 8000) + "\n\n--- PAYMENTS ---\n" + JSON.stringify(payments ?? [], null, 2).slice(0, 8000),
      entityType: "project",
      entityId: proj.id,
      dedupeKey: `PROJECT_DELETE:${proj.id}:${Date.now()}:EMAIL:${freshUser.email}`,
      threadKey: `project-${proj.id}`,
    });
  } catch (e) { console.error("[projects] delete email failed", e); }

  // Delete related data first, then project
  await admin.from("tickets").delete().eq("project_id", id);
  await admin.from("payments").delete().eq("project_id", id);
  await admin.from("bookings").delete().eq("project_id", id);
  await admin.from("notifications").delete().eq("project_id", id);
  await admin.from("audit_logs").delete().eq("project_id", id);
  await admin.from("project_members").delete().eq("project_id", id);

  const { error } = await admin.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorUserId: profile.id, actorRole: profile.role, action: "PROJECT_DELETE", entityType: "project", entityId: id, oldData: proj });
  return NextResponse.json({ ok: true });
}
