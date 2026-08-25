import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import InboxList from "@/components/notifications/InboxList";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader title="Inbox" description="Real-time updates and system messages." />
      {(!notifications || notifications.length === 0)
        ? <div className="card"><EmptyState title="No messages" description="Notifications appear here." /></div>
        : <InboxList initial={notifications} userId={user.id} />}
    </>
  );
}
