import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Tell the Directors that a newly registered user is waiting for approval.
 *
 * Previously this took a `userId` from an unauthenticated request body, so
 * anyone on the internet could push notifications into every Director's inbox
 * by posting UUIDs at it. It now derives the subject from the caller's own
 * session and ignores the body entirely — the only legitimate caller is the
 * user who just signed up, announcing themselves.
 */
export async function POST() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data: u } = await admin
    .from("app_users")
    .select("id, email, name, requested_role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (!u) return NextResponse.json({ ok: false }, { status: 404 });

  // Only a genuinely pending account is worth announcing. Without this an
  // approved user could re-post and re-notify at will.
  if (u.status !== "PENDING_APPROVAL") return NextResponse.json({ ok: true, skipped: true });

  const { data: directors } = await admin
    .from("app_users").select("id").eq("role", "DIRECTOR").eq("status", "APPROVED");
  if (directors?.length) {
    await admin.from("notifications").insert(directors.map((d) => ({
      recipient_user_id: d.id,
      category: "ACCESS_REQUEST",
      title: "New user access request",
      message: `${u.name} (${u.email}) requested ${u.requested_role}.`,
      entity_type: "user",
      entity_id: u.id,
      priority: "HIGH"
    })));
  }
  return NextResponse.json({ ok: true });
}
