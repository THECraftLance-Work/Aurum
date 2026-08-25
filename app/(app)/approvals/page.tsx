import { requireRole } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ApprovalRow from "@/components/users/ApprovalRow";
import { formatDateTime, roleLabels } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  await requireRole(["DIRECTOR"]);
  const supabase = createSupabaseServer();
  const { data: users } = await supabase
    .from("app_users")
    .select("*")
    .eq("status", "PENDING_APPROVAL")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="User approval center"
        description="Approve or reject users requesting access to the platform."
      />
      <div className="card p-0 overflow-hidden">
        {(!users || users.length === 0) ? (
          <EmptyState title="No pending requests" description="Newly registered users will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u: any) => (
              <li key={u.id} className="p-5 flex flex-wrap items-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-900 text-white font-semibold">
                  {u.name.split(" ").slice(0,2).map((s: string) => s[0]?.toUpperCase()).join("")}
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="text-sm font-semibold text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email} · {u.phone ?? "—"}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Requested: <span className="font-medium text-slate-700">{roleLabels[u.requested_role ?? u.role]}</span> · via {u.auth_provider} · {formatDateTime(u.created_at)}
                  </div>
                </div>
                <ApprovalRow userId={u.id} defaultRole={u.requested_role ?? u.role} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
