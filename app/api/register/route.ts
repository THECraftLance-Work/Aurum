import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, email, password, phone, employee_id, requested_role } = body ?? {};
  if (!name || !email || !password || !requested_role) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Create the auth user (email auto-confirmed so the user can sign in and see the pending screen)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name, phone, employee_id, requested_role }
  });
  if (createErr || !created.user) return NextResponse.json({ error: createErr?.message ?? "Sign-up failed." }, { status: 400 });

  const { error: profErr } = await admin.from("app_users").insert({
    id: created.user.id,
    name, email,
    phone: phone || null,
    employee_id: employee_id || null,
    role: requested_role,
    requested_role,
    auth_provider: "EMAIL",
    status: "PENDING_APPROVAL"
  });
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  // Notify directors
  const { data: directors } = await admin
    .from("app_users").select("id").eq("role", "DIRECTOR").eq("status", "APPROVED");
  if (directors?.length) {
    await admin.from("notifications").insert(directors.map((d) => ({
      recipient_user_id: d.id,
      category: "ACCESS_REQUEST",
      title: "New user access request",
      message: `${name} (${email}) requested ${requested_role}.`,
      entity_type: "user",
      entity_id: created.user.id,
      priority: "HIGH"
    })));
  }
  return NextResponse.json({ ok: true });
}
