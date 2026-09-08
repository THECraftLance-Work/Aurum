import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import InboxList from "@/components/notifications/InboxList";
import { getProjectScopeIds } from "@/lib/utils/projectScope";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const rawProject = (await cookies()).get("srivaraha_project")?.value ?? null;
  const projectId = rawProject && rawProject.trim() ? rawProject.trim() : null;
  const scopeIds = await getProjectScopeIds(supabase, projectId);

  let q: any = supabase.from("notifications").select("*").eq("recipient_user_id", user.id).order("created_at", { ascending: false }).limit(200);
  if (scopeIds && scopeIds.length > 0) {
    const scopeOr = scopeIds.map(id => `project_id.eq.${id}`).join(",");
    q = q.or(`${scopeOr},project_id.is.null`);
  }
  const { data: notifications } = await q;

  return (
    <>
      <PageHeader title="Inbox" description="Real-time updates and system messages." />
      {(!notifications || notifications.length === 0)
        ? <div className="card"><EmptyState title="No messages" description="Notifications appear here." /></div>
        : <InboxList initial={notifications} userId={user.id} />}
    </>
  );
}
