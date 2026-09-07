import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { buildWelcomeEmail } from "@/lib/integrations/templates";
import { enqueueDirectEmail } from "@/lib/integrations/outbound";

const ROLES = ["SM", "CP", "ACCOUNTANT", "ADMIN"] as const;

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: director } = await supabase.from("app_users").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!director || director.role !== "DIRECTOR" || director.status !== "APPROVED") return NextResponse.json({ error: "Only an approved Director can create employees." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = String(body.role ?? "SM");
  if (!name || !email || password.length < 8 || !ROLES.includes(role as typeof ROLES[number])) return NextResponse.json({ error: "Name, valid email, role, and a password of at least 8 characters are required." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: created, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (authError || !created.user) return NextResponse.json({ error: authError?.message ?? "Could not create account." }, { status: 400 });
  const { error: profileError } = await admin.from("app_users").insert({ id: created.user.id, name, email, phone: body.phone?.trim() || null, role, requested_role: role, auth_provider: "EMAIL", status: "APPROVED", approved_at: new Date().toISOString(), approved_by: user.id });
  if (profileError) { await admin.auth.admin.deleteUser(created.user.id); return NextResponse.json({ error: profileError.message }, { status: 500 }); }

  // Notify the employee: "your account has been created in AURUM" — retry 2-3 times is safe (dedupeKey makes re-creates idempotent, new users always send)
  for (let attempt = 0; attempt < 1; attempt++) {
    try {
      const mail = buildWelcomeEmail(name, email, role);
      const ok = await enqueueDirectEmail({
        eventKey: "USER_CREATED",
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        entityType: "user",
        entityId: created.user.id,
        dedupeKey: `USER_CREATED:${created.user.id}:EMAIL:${email.toLowerCase()}`,
        threadKey: `user-${created.user.id}`,
      });
      console.log(`[users] welcome email enqueue attempt ${attempt + 1}: ${ok ? "queued" : "deduplicated/failed"} for ${email}`);
      if (ok) break;
    } catch (e) {
      console.error(`[users] welcome email attempt ${attempt + 1} failed`, e);
    }
  }

  return NextResponse.json({ ok: true, id: created.user.id });
}
