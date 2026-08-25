import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login", request.url));

  const supabase = createSupabaseServer();
  await supabase.auth.exchangeCodeForSession(code);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Upsert profile for Google users
  const admin = createSupabaseAdmin();
  const { data: existing } = await admin
    .from("app_users").select("id, status").eq("id", user.id).maybeSingle();

  if (!existing) {
    await admin.from("app_users").insert({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name ?? user.email!.split("@")[0],
      avatar_url: user.user_metadata?.avatar_url,
      auth_provider: "GOOGLE",
      status: "PENDING_APPROVAL",
      role: "SM",
      requested_role: "SM"
    });
    // Notify directors
    const { data: directors } = await admin
      .from("app_users").select("id").eq("role", "DIRECTOR").eq("status", "APPROVED");
    if (directors?.length) {
      await admin.from("notifications").insert(directors.map((d) => ({
        recipient_user_id: d.id,
        category: "ACCESS_REQUEST",
        title: "New user access request",
        message: `${user.email} signed in with Google and is awaiting approval.`,
        entity_type: "user",
        entity_id: user.id,
        priority: "HIGH"
      })));
    }
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  await admin.from("app_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
  if (existing.status !== "APPROVED") return NextResponse.redirect(new URL("/pending", request.url));
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
