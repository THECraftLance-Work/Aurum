import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "SM" | "CP" | "ACCOUNTANT" | "ADMIN" | "DIRECTOR";
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUSPENDED" | "DISABLED";
  avatar_url?: string | null;
  auth_provider?: "GOOGLE" | "EMAIL" | null;
};

/**
 * Deduped per render pass via React `cache()`.
 *
 * The layout and every page under (app) both call requireUser(). Without this
 * wrapper each call made its own auth.getUser() + app_users select, so a single
 * navigation cost 4 sequential Supabase round-trips before any page data was
 * fetched. Now they share one result.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, email, name, role, status, avatar_url, auth_provider")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  return profile as SessionUser;
});

export const getAuthUserWithProfile = cache(async (): Promise<{ user: any | null; profile: SessionUser | null; revoked: boolean }> => {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, revoked: false };
  const { data: profile } = await supabase.from("app_users").select("id, email, name, role, status, avatar_url, auth_provider").eq("id", user.id).maybeSingle();
  if (!profile) return { user, profile: null, revoked: true };
  return { user, profile: profile as SessionUser, revoked: false };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "APPROVED") redirect("/pending");
  return user;
}

export async function requireRole(roles: SessionUser["role"][]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

export function revokedResponse() {
  // Used by API routes when auth user exists but app_users row was deleted by Director
  // Frontend shows this as a toast: "your account has been revoked..."
  return NextResponse.json({ error: "Your account has been revoked by the director please contact support." }, { status: 403 });
}

export async function getApiProfile(supabase: any, userId: string) {
  const { data: profile } = await supabase.from("app_users").select("id, role, status, name").eq("id", userId).maybeSingle();
  if (!profile) return { profile: null, revoked: true };
  return { profile, revoked: false };
}
