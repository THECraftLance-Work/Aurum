import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { notifyRole, writeAudit } from "@/lib/utils/notifications";

const Body = z.object({
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(5000),
  category: z.enum(["BUG","ACCESS","DATA_CORRECTION","BOOKING_ISSUE","PAYMENT_ISSUE","FEATURE_REQUEST","OTHER"]),
  priority: z.enum(["LOW","NORMAL","HIGH","URGENT"]),
  page_path: z.string().max(512).nullish(),
  user_agent: z.string().max(512).nullish(),
  related_entity_type: z.enum(["booking","payment"]).nullish(),
  related_entity_id: z.string().uuid().nullish()
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "APPROVED") {
    return NextResponse.json({ error: "Your account is not approved." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const b = parsed.data;

  const admin = createSupabaseAdmin();

  // Idempotency guard against double-submit (same pattern as /api/payments).
  const cutoff = new Date(Date.now() - 15_000).toISOString();
  const { data: dupe } = await admin
    .from("tickets").select("id, ticket_number")
    .eq("raised_by", profile.id).eq("subject", b.subject)
    .gte("created_at", cutoff).limit(1).maybeSingle();
  if (dupe) return NextResponse.json({ id: dupe.id, ticket_number: dupe.ticket_number, duplicate: true });

  const { data: t, error } = await admin.from("tickets").insert({
    raised_by: profile.id,
    raiser_role: profile.role,
    subject: b.subject,
    description: b.description,
    category: b.category,
    priority: b.priority,
    page_path: b.page_path ?? null,
    user_agent: b.user_agent ?? null,
    related_entity_type: b.related_entity_type ?? null,
    related_entity_id: b.related_entity_id ?? null
  }).select("id, ticket_number").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyRole("ADMIN", {
    category: "TICKET",
    title: "New support ticket",
    message: `${profile.name} raised ${t.ticket_number}: ${b.subject}`,
    entityType: "ticket",
    entityId: t.id,
    priority: b.priority
  });

  // Only escalate to Directors for URGENT, otherwise they get flooded by
  // routine tickets.
  if (b.priority === "URGENT") {
    await notifyRole("DIRECTOR", {
      category: "TICKET",
      title: "Urgent support ticket",
      message: `${profile.name} raised ${t.ticket_number}: ${b.subject}`,
      entityType: "ticket",
      entityId: t.id,
      priority: "URGENT"
    });
  }

  await writeAudit({
    actorUserId: profile.id,
    actorRole: profile.role,
    action: "TICKET_CREATE",
    entityType: "ticket",
    entityId: t.id,
    newData: { ticket_number: t.ticket_number, category: b.category, priority: b.priority, subject: b.subject }
  });

  return NextResponse.json({ id: t.id, ticket_number: t.ticket_number });
}
