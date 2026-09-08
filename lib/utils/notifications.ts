import { createSupabaseAdmin } from "@/lib/supabase/admin";

type NotifInput = {
  recipientUserId: string;
  category: "ACCESS_REQUEST" | "APPROVAL" | "REJECTION" | "PAYMENT" | "BOOKING" | "SYSTEM" | "IMPORTANT" | "TICKET";
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  projectId?: string | null;
};

export async function sendNotification(n: NotifInput) {
  const admin = createSupabaseAdmin();
  return admin.from("notifications").insert({
    recipient_user_id: n.recipientUserId,
    category: n.category,
    title: n.title,
    message: n.message,
    entity_type: n.entityType,
    entity_id: n.entityId,
    priority: n.priority ?? "NORMAL",
    project_id: n.projectId ?? null
  });
}

export async function notifyRole(role: "SM" | "CP" | "ACCOUNTANT" | "ADMIN" | "DIRECTOR", n: Omit<NotifInput, "recipientUserId">) {
  const admin = createSupabaseAdmin();
  let query = admin
    .from("app_users")
    .select("id, assigned_project_id, role")
    .eq("role", role)
    .eq("status", "APPROVED");

  const projectId = (n as any).projectId ?? null;
  // If role is SM, CP, or ACCOUNTANT and a projectId is given, filter to users assigned to this project or unassigned (all projects)
  if (projectId && ["SM", "CP", "ACCOUNTANT"].includes(role)) {
    query = query.or(`assigned_project_id.eq.${projectId},assigned_project_id.is.null`);
  }

  const { data: users } = await query;
  if (!users?.length) return;
  await admin.from("notifications").insert(
    users.map((u) => ({
      recipient_user_id: u.id,
      category: n.category,
      title: n.title,
      message: n.message,
      entity_type: n.entityType,
      entity_id: n.entityId,
      priority: n.priority ?? "NORMAL",
      project_id: projectId
    }))
  );
}

export async function writeAudit(entry: {
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
  reason?: string;
}) {
  const admin = createSupabaseAdmin();
  await admin.from("audit_logs").insert({
    actor_user_id: entry.actorUserId,
    actor_role: entry.actorRole,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    old_data: entry.oldData ?? null,
    new_data: entry.newData ?? null,
    reason: entry.reason
  });
}
