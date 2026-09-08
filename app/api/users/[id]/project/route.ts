import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/utils/notifications";

const Body = z.object({
  project_id: z.string().uuid().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: actor } = await supabase.from("app_users").select("id, role, status, name").eq("id", user.id).maybeSingle();
  if (!actor || actor.status !== "APPROVED" || !["ADMIN", "DIRECTOR"].includes(actor.role)) {
    return NextResponse.json({ error: "Only Admin/Director can assign projects." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid project_id" }, { status: 400 });
  const projectId = parsed.data.project_id;

  const admin = createSupabaseAdmin();

  if (projectId) {
    const { data: proj } = await admin.from("projects").select("id, slug, name, is_active").eq("id", projectId).maybeSingle();
    if (!proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!proj.is_active) return NextResponse.json({ error: "Project is not active" }, { status: 400 });
    if (proj.slug === "sri-varaha") return NextResponse.json({ error: "Cannot assign parent Sri Varaha" }, { status: 400 });
  }

  const { data: target } = await admin.from("app_users").select("id, role, assigned_project_id").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await admin.from("app_users").update({ assigned_project_id: projectId }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "USER_PROJECT_ASSIGN",
    entityType: "user",
    entityId: id,
    oldData: { assigned_project_id: target.assigned_project_id },
    newData: { assigned_project_id: projectId },
  });

  return NextResponse.json({ ok: true, assigned_project_id: projectId });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: actor } = await supabase.from("app_users").select("role, status").eq("id", user.id).maybeSingle();
  if (!actor || actor.status !== "APPROVED") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdmin();
  const { data: u } = await admin.from("app_users").select("assigned_project_id").eq("id", id).maybeSingle();
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ assigned_project_id: u.assigned_project_id });
}
