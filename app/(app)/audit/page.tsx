import { requireRole } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { formatDateTime, roleAccent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole(["ADMIN","DIRECTOR"]);
  const supabase = await createSupabaseServer();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, actor_role, reason, created_at, actor:actor_user_id(name, role)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader title="Audit logs" description="Every sensitive action recorded for accountability." />
      <div className="card p-0 overflow-hidden">
        {(!logs || logs.length === 0) ? (
          <EmptyState title="No audit records yet" description="Activity will appear here as soon as users act." />
        ) : (
          <ul className="max-h-[calc(100vh-250px)] divide-y divide-border overflow-y-auto overscroll-contain">
            {logs.map((l: any) => {
              const accent = roleAccent[l.actor_role] ?? roleAccent.SM;
              return (
                <li key={l.id} className="p-4 flex gap-4 items-start">
                  <div className={cn("mt-1 h-2 w-2 rounded-full", accent.dot)} />
                  <div className="flex-1">
                    <div className="text-sm text-slate-900">
                      <span className="font-medium">{l.actor?.name ?? "System"}</span>
                      {" · "}<span className="text-slate-600">{l.action.replaceAll("_"," ").toLowerCase()}</span>
                      {" · "}<span className="text-slate-500">{l.entity_type}</span>
                    </div>
                    {l.reason && <div className="mt-0.5 text-xs text-slate-500">Reason: {l.reason}</div>}
                    <div className="text-xs text-slate-400 mt-0.5">{formatDateTime(l.created_at)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
