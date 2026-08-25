import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification, notifyRole, writeAudit } from "@/lib/utils/notifications";

const Body = z.object({
  body: z.string().trim().min(1).max(4000),
  is_internal: z.boolean().optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase
    .from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!actor || actor.status !== "APPROVED") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: t } = await admin
    .from("tickets").select("id, ticket_number, raised_by, assigned_to, status").eq("id", params.id).maybeSingle();
  if (!t) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const isStaff = ["ADMIN", "DIRECTOR"].includes(actor.role);
  const isRaiser = t.raised_by === actor.id;
  const isAssignee = t.assigned_to === actor.id;
  if (!isStaff && !isRaiser && !isAssignee) {
    return NextResponse.json({ error: "You cannot comment on this ticket." }, { status: 403 });
  }

  // Internal notes are staff-only.
  const isInternal = Boolean(parsed.data.is_internal) && isStaff;

  const { error } = await admin.from("ticket_comments").insert({
    ticket_id: t.id,
    author_id: actor.id,
    author_role: actor.role,
    body: parsed.data.body,
    is_internal: isInternal
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the status column meaningful: a staff reply puts the ball in the
  // raiser's court, and a raiser reply hands it back.
  let nextStatus: string | null = null;
  if (!isInternal) {
    if (isStaff && !isRaiser && t.status === "OPEN") nextStatus = "WAITING_ON_USER";
    else if (isRaiser && t.status === "WAITING_ON_USER") nextStatus = "IN_PROGRESS";
  }
  if (nextStatus) {
    await admin.from("tickets").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", t.id);
  }

  // Notify the other side only — never yourself, never on internal notes.
  if (!isInternal) {
    if (isRaiser) {
      if (t.assigned_to) {
        await sendNotification({
          recipientUserId: t.assigned_to,
          category: "TICKET",
          title: `Reply on ${t.ticket_number}`,
          message: `${actor.name}: ${parsed.data.body.slice(0, 140)}`,
          entityType: "ticket", entityId: t.id, priority: "NORMAL"
        });
      } else {
        await notifyRole("ADMIN", {
          category: "TICKET",
          title: `Reply on ${t.ticket_number}`,
          message: `${actor.name}: ${parsed.data.body.slice(0, 140)}`,
          entityType: "ticket", entityId: t.id, priority: "NORMAL"
        });
      }
    } else if (t.raised_by !== actor.id) {
      await sendNotification({
        recipientUserId: t.raised_by,
        category: "TICKET",
        title: `Reply on ${t.ticket_number}`,
        message: `${actor.name}: ${parsed.data.body.slice(0, 140)}`,
        entityType: "ticket", entityId: t.id, priority: "NORMAL"
      });
    }
  }

  await writeAudit({
    actorUserId: actor.id, actorRole: actor.role,
    action: "TICKET_COMMENT", entityType: "ticket", entityId: t.id,
    newData: { is_internal: isInternal, status: nextStatus ?? t.status }
  });

  return NextResponse.json({ ok: true });
}
