import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification, writeAudit } from "@/lib/utils/notifications";
import { roleLabels } from "@/lib/utils/format";

const VALID_ROLES = ["SM", "CP", "ACCOUNTANT", "ADMIN", "DIRECTOR"] as const;
const Body = z.object({ role: z.enum(VALID_ROLES) });

/**
 * Change a user's role AFTER approval.
 *
 * Deliberately separate from /api/users/[id]/approve: that route also writes
 * `status`, nulls `approved_at` on revoke, and always notifies with
 * "Your access has been approved" — all wrong for a role change.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase
    .from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!actor || actor.status !== "APPROVED" || actor.role !== "DIRECTOR") {
    return NextResponse.json({ error: "Only a Director can change roles." }, { status: 403 });
  }
  if (actor.id === id) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  const nextRole = parsed.data.role;

  const admin = createSupabaseAdmin();
  const { data: target } = await admin
    .from("app_users").select("id, name, role, status").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (target.role === nextRole) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  // Lock-out guard: never let the last active Director be demoted, or nobody
  // can approve users or change roles again.
  if (target.role === "DIRECTOR" && nextRole !== "DIRECTOR") {
    const { count } = await admin
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "DIRECTOR")
      .eq("status", "APPROVED");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "This is the last active Director. Promote another Director before changing this one." },
        { status: 409 }
      );
    }
  }

  const { error } = await admin
    .from("app_users")
    .update({ role: nextRole })
    .eq("id", target.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendNotification({
    recipientUserId: target.id,
    category: "SYSTEM",
    title: "Your role has changed",
    message: `${actor.name} changed your role from ${roleLabels[target.role] ?? target.role} to ${roleLabels[nextRole] ?? nextRole}. Your available menus and permissions have been updated.`,
    entityType: "user",
    entityId: target.id,
    priority: "HIGH"
  });

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "USER_ROLE_CHANGE",
    entityType: "user",
    entityId: target.id,
    oldData: { role: target.role },
    newData: { role: nextRole }
  });

  return NextResponse.json({ ok: true, role: nextRole });
}
