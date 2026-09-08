import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/utils/notifications";
import { revokedResponse } from "@/lib/auth/session";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!profile) return revokedResponse();
  if (profile.status !== "APPROVED") return NextResponse.json({ error: "Not approved" }, { status: 403 });

  const admin = createSupabaseAdmin();
  const { data } = await admin.from("projects").select("id, slug, name, parent_id, is_active, default_sale_consideration, default_areas, created_at").eq("is_active", true).order("name");
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!profile) return revokedResponse();
  if (profile.role !== "ADMIN" || profile.status !== "APPROVED") return NextResponse.json({ error: "Only Admin can create projects" }, { status: 403 });

  const { name, slug, parent_slug, default_sale_consideration, default_areas } = await req.json().catch(()=> ({}));
  if (!name || !slug) return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  const cleanSlug = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
  const admin = createSupabaseAdmin();
  let parent_id: string | null = null;
  if (parent_slug) {
    const { data: parent } = await admin.from("projects").select("id").eq("slug", parent_slug).maybeSingle();
    if (parent) parent_id = parent.id;
  } else {
    const { data: sv } = await admin.from("projects").select("id").eq("slug", "sri-varaha").maybeSingle();
    if (sv) parent_id = sv.id;
  }
  const { data, error } = await admin.from("projects").insert({
    slug: cleanSlug, name: String(name).trim(), parent_id, is_active: true,
    default_sale_consideration: default_sale_consideration ? Number(default_sale_consideration) : null,
    default_areas: default_areas ?? {},
    created_by: profile.id
  }).select("id, slug, name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorUserId: profile.id, actorRole: profile.role, action: "PROJECT_CREATE", entityType: "project", entityId: data.id, newData: { slug: cleanSlug, name } });
  return NextResponse.json({ ok: true, project: data });
}
