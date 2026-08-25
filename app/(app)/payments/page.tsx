import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatINR } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await requireUser();
  const supabase = createSupabaseServer();
  let q = supabase.from("payments")
    .select("*, booking:booking_id(booking_id, project_name), submitter:submitted_by(name, role)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (["SM","CP"].includes(user.role)) q = q.eq("submitted_by", user.id);
  const { data: payments } = await q;

  return (
    <>
      <PageHeader title="Payments" description="Track all payment entries and their verification status." />
      <div className="card p-0 overflow-hidden">
        {(!payments || payments.length === 0) ? (
          <EmptyState title="No payments recorded" description="Payments appear here once submitted." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Mode</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <Link href={`/bookings/${p.booking_id}`} className="font-medium text-slate-900 hover:underline">
                        {p.booking?.booking_id ?? "—"}
                      </Link>
                      <div className="text-xs text-slate-500">{p.booking?.project_name ?? ""}</div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatINR(p.amount)}</td>
                    <td className="px-5 py-3">{formatDate(p.payment_date)}</td>
                    <td className="px-5 py-3">{p.payment_mode.replaceAll("_"," ")}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 text-slate-500">{p.submitter?.name ?? "—"}</td>
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
