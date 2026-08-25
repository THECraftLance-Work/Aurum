import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: u } = await admin.from("app_users").select("email, name, requested_role, auth_provider, created_at").eq("id", userId).maybeSingle();
  if (!u) return NextResponse.json({ ok: false }, { status: 404 });

  const { data: directors } = await admin
    .from("app_users").select("id").eq("role", "DIRECTOR").eq("status", "APPROVED");
  if (directors?.length) {
    await admin.from("notifications").insert(directors.map((d) => ({
      recipient_user_id: d.id,
      category: "ACCESS_REQUEST",
      title: "New user access request",
      message: `${u.name} (${u.email}) requested ${u.requested_role}.`,
      entity_type: "user",
      entity_id: userId,
      priority: "HIGH"
    })));
  }
  return NextResponse.json({ ok: true });
}
