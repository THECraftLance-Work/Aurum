import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import Tooltip from "@/components/ui/Tooltip";
import { formatDateTime, priorityBadge, ticketCategoryLabels } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "OPEN", label: "Open", statuses: ["OPEN", "IN_PROGRESS", "WAITING_ON_USER"] },
  { key: "RESOLVED", label: "Resolved", statuses: ["RESOLVED", "CLOSED"] },
  { key: "ALL", label: "All", statuses: [] as string[] }
];

export default async function TicketsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  const tab = TABS.find((t) => t.key === (searchParams.tab ?? "OPEN")) ?? TABS[0];

  // RLS scopes this automatically: raisers see their own, ADMIN/DIRECTOR see all.
  let q = supabase
    .from("tickets")
    .select("id, ticket_number, subject, category, priority, status, created_at, last_activity_at, raiser:raised_by(name, role), assignee:assigned_to(name)")
    .order("last_activity_at", { ascending: false })
    .limit(100);
  if (tab.statuses.length) q = q.in("status", tab.statuses);

  const { data: tickets } = await q;
  const isStaff = ["ADMIN", "DIRECTOR"].includes(user.role);

  return (
    <>
      <PageHeader
        title="Support"
        description={isStaff
          ? "Tickets raised across the organization."
          : "Tickets you have raised. Use the life-ring in the header to raise a new one."}
      />

      <div className="mb-4 flex w-fit items-center gap-1.5 rounded-2xl border border-border bg-white p-1 shadow-card">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/tickets?tab=${t.key}`}
            className={cn(
              "rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-150",
              tab.key === t.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            )}
          >{t.label}</Link>
        ))}
      </div>

      <div className="card min-w-0 overflow-hidden p-0">
        {(!tickets || tickets.length === 0) ? (
          <EmptyState
            title="No tickets here"
            description={isStaff ? "Nothing needs attention right now." : "Raise one from the life-ring icon in the header."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[120px]" />
                <col />
                <col className="w-[140px]" />
                <col className="w-[110px]" />
                <col className="w-[130px]" />
                <col className="w-[150px]" />
              </colgroup>
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Ticket</th>
                  <th className="px-5 py-3 font-medium">Subject</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Activity</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t: any) => (
                  <tr key={t.id} className="row-hover border-t border-border">
                    <td className="px-5 py-3">
                      <Link href={`/tickets/${t.id}`} className="font-mono text-xs font-semibold text-slate-900 hover:text-accent">
                        {t.ticket_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Tooltip label={t.subject}>
                        <span className="cell-truncate font-medium text-slate-900">{t.subject}</span>
                      </Tooltip>
                      {isStaff && (
                        <div className="truncate text-xs text-slate-500">
                          {t.raiser?.name} · {t.raiser?.role}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="cell-truncate text-slate-600">{ticketCategoryLabels[t.category] ?? t.category}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("badge", priorityBadge[t.priority])}>{t.priority}</span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-3 text-xs text-slate-500">{formatDateTime(t.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
