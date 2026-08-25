import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification, writeAudit } from "@/lib/utils/notifications";

const Body = z.object({
  status: z.enum(["OPEN","IN_PROGRESS","WAITING_ON_USER","RESOLVED","CLOSED"]).optional(),
  assigned_to: z.string().uuid().nullish(),
  priority: z.enum(["LOW","NORMAL","HIGH","URGENT"]).optional(),
  resolution_note: z.string().trim().max(4000).optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase
    .from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!actor || actor.status !== "APPROVED" || !["ADMIN","DIRECTOR"].includes(actor.role)) {
    return NextResponse.json({ error: "You do not have permission to manage tickets." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const b = parsed.data;

  const admin = createSupabaseAdmin();
  const { data: t } = await admin
    .from("tickets").select("*").eq("id", params.id).maybeSingle();
  if (!t) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  // Mirrors the booking-review rule: a resolution must say what was done.
  if (b.status === "RESOLVED" && !b.resolution_note?.trim() && !t.resolution_note) {
    return NextResponse.json({ error: "A resolution note is required when resolving a ticket." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now, last_activity_at: now };
  if (b.status) patch.status = b.status;
  if (b.priority) patch.priority = b.priority;
  if (b.assigned_to !== undefined) patch.assigned_to = b.assigned_to;
  if (b.resolution_note !== undefined) patch.resolution_note = b.resolution_note;
  if (b.status === "RESOLVED") { patch.resolved_by = actor.id; patch.resolved_at = now; }
  if (b.status === "CLOSED") patch.closed_at = now;

  const { error } = await admin.from("tickets").update(patch).eq("id", t.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (b.status && b.status !== t.status) {
    await sendNotification({
      recipientUserId: t.raised_by,
      category: "TICKET",
      title: `Ticket ${t.ticket_number} — ${b.status.replaceAll("_", " ").toLowerCase()}`,
      message: b.resolution_note?.trim()
        ? `${actor.name}: ${b.resolution_note.trim()}`
        : `${actor.name} updated your ticket to ${b.status.replaceAll("_", " ")}.`,
      entityType: "ticket",
      entityId: t.id,
      priority: b.status === "RESOLVED" ? "NORMAL" : "LOW"
    });
  }

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "TICKET_UPDATE",
    entityType: "ticket",
    entityId: t.id,
    oldData: { status: t.status, assigned_to: t.assigned_to, priority: t.priority },
    newData: { status: patch.status ?? t.status, assigned_to: patch.assigned_to ?? t.assigned_to, priority: patch.priority ?? t.priority },
    reason: b.resolution_note?.trim() || undefined
  });

  return NextResponse.json({ ok: true });
}
