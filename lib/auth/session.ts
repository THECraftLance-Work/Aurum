import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "SM" | "CP" | "ACCOUNTANT" | "ADMIN" | "DIRECTOR";
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUSPENDED" | "DISABLED";
  avatar_url?: string | null;
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
    .select("id, email, name, role, status, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  return profile as SessionUser;
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
