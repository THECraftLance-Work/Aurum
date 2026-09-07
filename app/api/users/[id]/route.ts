import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/utils/notifications";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase.from("app_users").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!actor || actor.role !== "DIRECTOR" || actor.status !== "APPROVED") {
    return NextResponse.json({ error: "Only Director can delete users." }, { status: 403 });
  }
  if (actor.id === id) return NextResponse.json({ error: "You cannot delete yourself." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: target } = await admin.from("app_users").select("id, name, email").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Delete profile first, then auth user. Audit before deletion.
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "USER_DELETE",
    entityType: "user",
    entityId: target.id,
    oldData: { name: target.name, email: target.email },
  });

  const { error: delProfileErr } = await admin.from("app_users").delete().eq("id", id);
  if (delProfileErr) return NextResponse.json({ error: delProfileErr.message }, { status: 500 });

  const { error: authErr } = await admin.auth.admin.deleteUser(id);
  // auth deletion failure is non-fatal if profile already gone; log and continue
  if (authErr) console.error("[users] auth delete failed", authErr.message);

  return NextResponse.json({ ok: true });
}
