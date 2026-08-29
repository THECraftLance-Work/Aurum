import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type DirectoryEntry = { id: string; name: string; role: string };

/**
 * Resolve user ids to display name + role.
 *
 * Why this exists instead of a PostgREST embedded join:
 *
 * The `users_self_read` RLS policy is
 *   `id = auth.uid() OR current_role() IN ('ADMIN','DIRECTOR')`
 * so an Accountant, SM or CP reading a booking under their own session gets
 * NULL back for `creator:created_by(name)` — the row is invisible to them.
 * That rendered as "—" wherever a colleague's name should appear, which made
 * "Submitted by" look broken on records the user is perfectly entitled to see.
 *
 * Widening that policy would expose email, phone and employee_id org-wide, and
 * RLS is row-level so it can't hand out just the name. Instead the caller — a
 * page that has already authorised the viewer — resolves the handful of names
 * it needs through the service-role client. Only `name` and `role` are ever
 * read, so nothing more leaks than the UI already intends to show.
 *
 * One batched query per page, deduped, and null-safe.
 */
export async function resolveDirectory(
  ids: (string | null | undefined)[]
): Promise<Map<string, DirectoryEntry>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  const map = new Map<string, DirectoryEntry>();
  if (unique.length === 0) return map;

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("app_users")
    .select("id, name, role")
    .in("id", unique);

  for (const u of data ?? []) {
    map.set(u.id, { id: u.id, name: u.name, role: u.role });
  }
  return map;
}

/** "Ravi Kumar (SM)", or a dash when the user was deleted. */
export function displayUser(
  dir: Map<string, DirectoryEntry>,
  id: string | null | undefined,
  opts?: { withRole?: boolean }
): string {
  if (!id) return "—";
  const u = dir.get(id);
  if (!u) return "Unknown user";
  return opts?.withRole ? `${u.name} (${u.role})` : u.name;
}
