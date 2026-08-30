import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import Tooltip from "@/components/ui/Tooltip";
import { formatDate, formatINR, roleLabels } from "@/lib/utils/format";
import { resolveDirectory, displayUser } from "@/lib/utils/directory";
import {
  ClipboardList, Wallet, TrendingUp, ShieldCheck, CheckCircle2, XCircle, Users, Clock, Plus, ArrowRight
} from "lucide-react";
import AddEmployeeButton from "@/components/users/AddEmployeeButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const own = ["SM", "CP"].includes(user.role);

  // All four run in parallel. The aggregate is a Postgres RPC — previously this
  // page pulled every booking row and reduced in JS to produce six numbers.
  const [statsRes, bookingsRes, paymentsRes, pendingUsersRes] = await Promise.all([
    supabase.rpc("get_dashboard_stats").maybeSingle(),
    own
      ? supabase.from("bookings").select("id, booking_id, project_name, unit_number, total_property_value, total_amount_paid, status, created_at").eq("created_by", user.id).order("created_at", { ascending: false }).limit(50)
      : supabase.from("bookings").select("id, booking_id, project_name, unit_number, total_property_value, total_amount_paid, status, created_at").order("created_at", { ascending: false }).limit(50),
    own
      ? supabase.from("payments").select("id, amount, payment_date, payment_mode, status, submitted_by, booking:booking_id(booking_id)").eq("submitted_by", user.id).order("created_at", { ascending: false }).limit(50)
      : supabase.from("payments").select("id, amount, payment_date, payment_mode, status, submitted_by, booking:booking_id(booking_id)").order("created_at", { ascending: false }).limit(50),
    user.role === "DIRECTOR"
      ? supabase.from("app_users").select("id", { count: "exact", head: true }).eq("status", "PENDING_APPROVAL")
      : Promise.resolve({ count: 0 } as any)
  ]);

  // Fall back to computing from the rows we already have if the aggregate RPC
  // is unavailable (e.g. migration 0002 not yet applied, or a transient error).
  // A failed KPI tile must not take down the whole dashboard.
  let s = (statsRes.data ?? null) as Record<string, number> | null;
  if (!s) {
    const { data: agg } = own
      ? await supabase.from("bookings").select("total_property_value, total_amount_paid, remaining_balance, status").eq("created_by", user.id).limit(1000)
      : await supabase.from("bookings").select("total_property_value, total_amount_paid, remaining_balance, status").limit(1000);
    const a = agg ?? [];
    s = {
      total_bookings: a.length,
      total_value: a.reduce((t, r: any) => t + Number(r.total_property_value ?? 0), 0),
      total_received: a.reduce((t, r: any) => t + Number(r.total_amount_paid ?? 0), 0),
      total_pending: a.reduce((t, r: any) => t + Number(r.remaining_balance ?? 0), 0),
      pending_verification: a.filter((r: any) => ["SUBMITTED", "UNDER_REVIEW", "UPDATED"].includes(r.status)).length,
      approved_count: a.filter((r: any) => r.status === "APPROVED").length,
      rejected_count: a.filter((r: any) => r.status === "REJECTED").length
    };
  }

  const bookings = bookingsRes.data ?? [];
  const recentPayments = paymentsRes.data ?? [];
  const pendingUsers = pendingUsersRes.count ?? 0;

  // Names for "recorded by" — RLS hides other users from non-admin sessions.
  const dir = await resolveDirectory(recentPayments.map((p: any) => p.submitted_by));

  return (
    <>
      <PageHeader
        title={`Hello ${user.name.split(" ")[0]}`}
        description={`${roleLabels[user.role]} · here's what's happening today.`}
        actions={
          <div className="flex items-center gap-2">
            {user.role === "DIRECTOR" && <AddEmployeeButton />}
            {["SM", "CP", "ADMIN", "DIRECTOR"].includes(user.role) && (
              <Link href="/bookings/new" className="btn-primary h-10">
                <Plus className="h-4 w-4" /> New booking
              </Link>
            )}
          </div>
        }
      />

      <section className="dashboard-section stagger-children grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div style={{ ["--stagger" as any]: 0 }}><StatCard label="Total bookings"       value={s.total_bookings ?? 0}            tone="blue"    icon={<ClipboardList className="h-4 w-4" />} /></div>
        <div style={{ ["--stagger" as any]: 1 }}><StatCard label="Total property value" value={formatINR(s.total_value)}         tone="violet"  icon={<TrendingUp className="h-4 w-4" />} /></div>
        <div style={{ ["--stagger" as any]: 2 }}><StatCard label="Amount received"      value={formatINR(s.total_received)}      tone="emerald" icon={<Wallet className="h-4 w-4" />} /></div>
        <div style={{ ["--stagger" as any]: 3 }}><StatCard label="Pending balance"      value={formatINR(s.total_pending)}       tone="amber"   icon={<Clock className="h-4 w-4" />} /></div>
      </section>

      <section className="dashboard-section stagger-children mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div style={{ ["--stagger" as any]: 4 }}><StatCard label="Pending verification" value={s.pending_verification ?? 0} tone="amber"   icon={<ShieldCheck className="h-4 w-4" />} /></div>
        <div style={{ ["--stagger" as any]: 5 }}><StatCard label="Approved"             value={s.approved_count ?? 0}       tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} /></div>
        <div style={{ ["--stagger" as any]: 6 }}><StatCard label="Rejected"             value={s.rejected_count ?? 0}       tone="rose"    icon={<XCircle className="h-4 w-4" />} /></div>
        {user.role === "DIRECTOR" && (
          <div style={{ ["--stagger" as any]: 7 }}>
            <StatCard label="Users awaiting approval" value={pendingUsers} tone="violet" icon={<Users className="h-4 w-4" />} />
          </div>
        )}
      </section>

      {(user.role === "ADMIN" || user.role === "DIRECTOR") && (
        <section className="dashboard-section mt-6">
          <div className="card p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{user.role === "DIRECTOR" ? "Organization control" : "Operations control"}</h3>
                <p className="mt-1 text-xs text-slate-500">{user.role === "DIRECTOR" ? "Manage access, people, and organization oversight." : "Manage verification, support, and daily platform operations."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(user.role === "DIRECTOR"
                  ? [["/approvals", "User approvals"], ["/users", "Employees"], ["/audit", "Audit logs"]]
                  : [["/verification", "Verification"], ["/tickets", "Support"], ["/audit", "Audit logs"]]
                ).map(([href, label]) => <Link key={href} href={href} className="btn-secondary h-9 text-xs">{label}<ArrowRight className="h-3.5 w-3.5" /></Link>)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* items-start: each card sizes to its own content. Without it the grid
          stretches every item to the tallest in the row, so a long Payment
          activity list left a large void under Recent bookings. */}
      <section className="dashboard-section mt-6 grid min-w-0 items-start gap-4 xl:grid-cols-3">
        <div className="card min-w-0 overflow-hidden p-0 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent bookings</h3>
            <Link href="/bookings" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-accent">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {bookings.length === 0 ? (
            <EmptyState title="No bookings yet" description="Create a new booking to see it here." />
          ) : (
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[130px]" />
                  <col />
                  <col className="w-[120px]" />
                  <col className="w-[120px]" />
                  <col className="w-[130px]" />
                </colgroup>
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Booking</th>
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 text-right font-medium">Value</th>
                    <th className="px-5 py-3 text-right font-medium">Paid</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b: any) => (
                    <tr key={b.id} className="row-hover border-t border-border">
                      <td className="px-5 py-3">
                        <Link href={`/bookings/${b.id}`} className="cell-truncate font-medium text-slate-900 hover:text-accent">{b.booking_id}</Link>
                        <span className="cell-truncate text-xs text-slate-500">{formatDate(b.created_at)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <Tooltip className="block" label={b.project_name}>
                          <span className="cell-truncate text-slate-900">{b.project_name}</span>
                        </Tooltip>
                        <Tooltip className="block" label={`Unit ${b.unit_number}`}>
                          <span className="cell-truncate text-xs text-slate-500">Unit {b.unit_number}</span>
                        </Tooltip>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatINR(b.total_property_value)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatINR(b.total_amount_paid)}</td>
                      <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card min-w-0 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Payment activity</h3>
            <Link href="/payments" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-accent">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {recentPayments.length === 0 ? (
            <EmptyState title="No payments" description="Payments will appear here." />
          ) : (
            <ul className="max-h-[400px] divide-y divide-border overflow-y-auto">
              {recentPayments.map((p: any) => (
                <li key={p.id}>
                  <Link href={`/payments/${p.id}`} className="block px-5 py-3.5 transition-colors hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium tabular-nums text-slate-900">{formatINR(p.amount)}</div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {(Array.isArray(p.booking) ? p.booking[0] : p.booking)?.booking_id ?? "—"}
                      {" · "}{formatDate(p.payment_date)} · {p.payment_mode.replaceAll("_", " ")}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      Recorded by {displayUser(dir, p.submitted_by, { withRole: true })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
