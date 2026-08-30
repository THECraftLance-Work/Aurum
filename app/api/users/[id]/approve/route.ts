import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification, writeAudit } from "@/lib/utils/notifications";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase.from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!actor || actor.role !== "DIRECTOR" || actor.status !== "APPROVED") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { decision, role } = await req.json();
  if (!["APPROVED","REJECTED"].includes(decision)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: target } = await admin.from("app_users").select("*").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await admin.from("app_users").update({
    status: decision,
    role: decision === "APPROVED" ? role : target.role,
    approved_at: decision === "APPROVED" ? new Date().toISOString() : null,
    approved_by: actor.id
  }).eq("id", target.id);

  await sendNotification({
    recipientUserId: target.id,
    category: decision === "APPROVED" ? "APPROVAL" : "REJECTION",
    title: decision === "APPROVED" ? "Account approved" : "Account rejected",
    message: decision === "APPROVED"
      ? `Your access has been approved by the Director. You now have ${role} access.`
      : `Your access request was rejected. Please contact the administrator.`,
    priority: "URGENT",
    entityType: "user", entityId: target.id
  });

  await writeAudit({
    actorUserId: actor.id, actorRole: actor.role,
    action: decision === "APPROVED" ? "USER_APPROVE" : "USER_REJECT",
    entityType: "user", entityId: target.id,
    oldData: { role: target.role, status: target.status },
    newData: { role: decision === "APPROVED" ? role : target.role, status: decision }
  });

  return NextResponse.json({ ok: true });
}
