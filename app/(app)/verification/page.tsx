import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "PENDING",  label: "Pending",  statuses: ["SUBMITTED","UNDER_REVIEW","UPDATED"] },
  { key: "APPROVED", label: "Approved", statuses: ["APPROVED"] },
  { key: "REJECTED", label: "Rejected", statuses: ["REJECTED"] }
];

export default async function VerificationPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requireRole(["ACCOUNTANT","ADMIN","DIRECTOR"]);
  const tab = TABS.find((t) => t.key === (searchParams.tab ?? "PENDING")) ?? TABS[0];
  const supabase = createSupabaseServer();

  const { data: rows } = await supabase
    .from("bookings")
    .select("*, customer:customer_id(name), creator:created_by(name, role)")
    .in("status", tab.statuses)
    .order("submitted_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader title="Verification queue" description="Review submitted bookings and payments." />

      <div className="mb-4 flex items-center gap-1.5 rounded-2xl border border-border bg-white p-1 shadow-card w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/verification?tab=${t.key}`}
            className={cn(
              "rounded-xl px-4 py-1.5 text-sm font-medium transition",
              tab.key === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >{t.label}</Link>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {(!rows || rows.length === 0) ? (
          <EmptyState title="Nothing to review" description="Newly submitted bookings will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Submitted by</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium text-right">Value</th>
                  <th className="px-5 py-3 font-medium text-right">Paid</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b: any) => (
                  <tr key={b.id} className="border-t border-border hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/bookings/${b.id}`} className="font-medium text-slate-900 hover:underline">{b.booking_id}</Link>
                    </td>
                    <td className="px-5 py-3">{b.customer?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="text-slate-900">{b.creator?.name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{b.creator?.role}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-slate-900">{b.project_name}</div>
                      <div className="text-xs text-slate-500">Unit {b.unit_number}</div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatINR(b.total_property_value)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{formatINR(b.total_amount_paid)}</td>
                    <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(b.submitted_at)}</td>
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
