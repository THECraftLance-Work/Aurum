import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueDirectEmail } from "@/lib/integrations/outbound";
import { renderEmail } from "@/lib/integrations/templates";
import { revokedResponse } from "@/lib/auth/session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("app_users").select("id, role, status, name, email").eq("id", user.id).maybeSingle();
  if (!profile) return revokedResponse();
  if (profile.role !== "DIRECTOR") return NextResponse.json({ error: "Only Director" }, { status: 403 });

  const admin = createSupabaseAdmin();
  const { data: proj } = await admin.from("projects").select("id, slug, name").eq("id", id).maybeSingle();
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await admin.from("project_delete_otps").insert({
    project_id: id,
    director_id: profile.id,
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  const mail = renderEmail({
    preheader: `Delete code for ${proj.name}: ${code}`,
    eyebrow: "Verification code",
    heading: `Delete ${proj.name}?`,
    intro: [`Your verification code to delete project ${proj.name} (${proj.slug}) is:`],
    highlight: { label: "Code", value: code, sub: "Valid for 10 minutes", tone: "negative" },
    outro: ["If you didn't request this, ignore this email."],
    footerReason: "You requested to delete a project in AURUM.",
  } as any);

  await enqueueDirectEmail({
    eventKey: "PROJECT_DELETE_OTP",
    to: profile.email,
    subject: `Delete code for ${proj.name}: ${code}`,
    html: mail.html,
    text: mail.text,
    entityType: "project",
    entityId: proj.id,
    dedupeKey: `PROJECT_DELETE_OTP:${proj.id}:${Date.now()}:EMAIL:${profile.email}`,
  });

  return NextResponse.json({ ok: true });
}
