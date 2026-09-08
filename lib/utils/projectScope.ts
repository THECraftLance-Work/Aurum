import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the array of project UUIDs that should be queried for a given selected project.
 * - If selectedProjectId is the parent project ("Sri Varaha"), returns [parent.id, ...subprojectIds]
 *   so that the parent project dashboard/ledgers aggregate across all its sub-projects (Aurum, Tatva).
 * - If selectedProjectId is a sub-project (Tatva or Aurum), returns [selectedProjectId].
 * - If selectedProjectId is null/empty ("All Projects" for Admin/Director), returns null (unfiltered).
 */
export async function getProjectScopeIds(
  supabase: SupabaseClient,
  selectedProjectId: string | null | undefined
): Promise<string[] | null> {
  if (!selectedProjectId || !selectedProjectId.trim()) {
    return null;
  }

  const pid = selectedProjectId.trim();

  // Check if this project is a parent project with sub-projects
  const { data: subprojects } = await supabase
    .from("projects")
    .select("id")
    .eq("parent_id", pid)
    .eq("is_active", true);

  if (subprojects && subprojects.length > 0) {
    return [pid, ...subprojects.map((p) => p.id)];
  }

  return [pid];
}
