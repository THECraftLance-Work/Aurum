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
  const { data } = await admin.from("projects").select("id, slug, name, parent_id, is_active, logo_url, default_sale_consideration, default_areas, created_at").eq("is_active", true).order("name");
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!profile) return revokedResponse();
  if (profile.role !== "ADMIN" || profile.status !== "APPROVED") return NextResponse.json({ error: "Only Admin can create projects" }, { status: 403 });

  const { name, slug, parent_slug, default_sale_consideration, default_areas, logo } = await req.json().catch(()=> ({}));
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
  }).select("id, slug, name, logo_url").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  let logoUrl: string | null = null;
  if (typeof logo === "string" && logo.startsWith("data:image/")) {
    const match = logo.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
    if (!match) return NextResponse.json({ error: "Logo must be PNG, JPG, or WebP" }, { status: 400 });
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 2 * 1024 * 1024) return NextResponse.json({ error: "Logo must be 2 MB or smaller" }, { status: 400 });
    const extension = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
    const path = `${data.id}.${extension}`;
    const upload = await admin.storage.from("project-logos").upload(path, buffer, { contentType: match[1], upsert: true });
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 });
    logoUrl = admin.storage.from("project-logos").getPublicUrl(path).data.publicUrl;
    await admin.from("projects").update({ logo_url: logoUrl }).eq("id", data.id);
  }
  await writeAudit({ actorUserId: profile.id, actorRole: profile.role, action: "PROJECT_CREATE", entityType: "project", entityId: data.id, newData: { slug: cleanSlug, name } });
  return NextResponse.json({ ok: true, project: { ...data, logo_url: logoUrl } });
}
