import Link from "next/link";
import { cookies } from "next/headers";
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
import { getProjectScopeIds } from "@/lib/utils/projectScope";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const rawProject = (await cookies()).get("srivaraha_project")?.value ?? null;
  const projectId = rawProject && rawProject.trim() ? rawProject.trim() : null;
  const scopeIds = await getProjectScopeIds(supabase, projectId);

  const own = ["SM", "CP"].includes(user.role);

  // Project-scoped when column exists; falls back to unfiltered if migration not yet applied
  let bq: any = supabase.from("bookings").select("id, booking_id, project_name, unit_number, total_property_value, total_amount_paid, status, created_at, project_id");
  if (own) bq = bq.eq("created_by", user.id);
  if (scopeIds) {
    bq = bq.in("project_id", scopeIds);
  }
  const bookingsQ = bq.order("created_at", { ascending: false }).limit(50);

  let pq: any = supabase.from("payments").select("id, amount, payment_date, payment_mode, status, submitted_by, booking:booking_id(booking_id), project_id");
  if (own) pq = pq.eq("submitted_by", user.id);
  if (scopeIds) {
    pq = pq.in("project_id", scopeIds);
  }
  const paymentsQ = pq.order("created_at", { ascending: false }).limit(50);

  let statsResRaw: any, bookingsRes: any, paymentsRes: any, pendingUsersRes: any;
  try {
    [statsResRaw, bookingsRes, paymentsRes, pendingUsersRes] = await Promise.all([
      scopeIds ? Promise.resolve({ data: null } as any) : supabase.rpc("get_dashboard_stats").maybeSingle(),
      bookingsQ,
      paymentsQ,
      user.role === "DIRECTOR"
        ? supabase.from("app_users").select("id", { count: "exact", head: true }).eq("status", "PENDING_APPROVAL")
        : Promise.resolve({ count: 0 } as any)
    ]);
  } catch (e: any) {
    // project_id column not yet migrated — retry without project filter so dashboard still opens for Admin
    if (/project_id|column|schema cache/i.test(String(e?.message ?? e))) {
      const bq2: any = supabase.from("bookings").select("id, booking_id, project_name, unit_number, total_property_value, total_amount_paid, status, created_at").order("created_at", { ascending: false }).limit(50);
      const pq2: any = supabase.from("payments").select("id, amount, payment_date, payment_mode, status, submitted_by, booking:booking_id(booking_id)").order("created_at", { ascending: false }).limit(50);
      [statsResRaw, bookingsRes, paymentsRes, pendingUsersRes] = await Promise.all([
        supabase.rpc("get_dashboard_stats").maybeSingle(),
        own ? bq2.eq("created_by", user.id) : bq2,
        own ? pq2.eq("submitted_by", user.id) : pq2,
        user.role === "DIRECTOR" ? supabase.from("app_users").select("id", { count: "exact", head: true }).eq("status", "PENDING_APPROVAL") : Promise.resolve({ count: 0 } as any)
      ]);
    } else throw e;
  }

  // Fall back to computing from the rows we already have if the aggregate RPC
  // is unavailable (e.g. migration 0002 not yet applied, or a transient error).
  // A failed KPI tile must not take down the whole dashboard — especially for
  // ACCOUNTANT where RLS / project scoping could otherwise blank the page.
  let s = ((statsResRaw as any)?.data ?? null) as Record<string, number> | null;
  if (!s) {
    try {
      let aq: any = supabase.from("bookings").select("total_property_value, total_amount_paid, remaining_balance, status, project_id");
      if (own) aq = aq.eq("created_by", user.id);
      if (scopeIds) {
        aq = aq.in("project_id", scopeIds);
      }
      const { data: agg, error: aggErr } = await aq.limit(1000);
      if (aggErr) throw aggErr;
      const a = agg ?? [];
      s = {
        total_bookings: a.length,
        total_value: a.reduce((t: number, r: any) => t + Number(r.total_property_value ?? 0), 0),
        total_received: a.reduce((t: number, r: any) => t + Number(r.total_amount_paid ?? 0), 0),
        total_pending: a.reduce((t: number, r: any) => t + Number(r.remaining_balance ?? 0), 0),
        pending_verification: a.filter((r: any) => ["SUBMITTED", "UNDER_REVIEW", "UPDATED"].includes(r.status)).length,
        approved_count: a.filter((r: any) => r.status === "APPROVED").length,
        rejected_count: a.filter((r: any) => r.status === "REJECTED").length
      };
    } catch {
      // Last resort: count what we already fetched so dashboard never crashes
      const a = (bookingsRes as any)?.data ?? [];
      try {
        const { data: fallback } = await supabase.from("bookings").select("total_property_value, total_amount_paid, remaining_balance, status").limit(1000);
        const fa = fallback ?? a;
        s = {
          total_bookings: fa.length,
          total_value: fa.reduce((t: number, r: any) => t + Number(r.total_property_value ?? 0), 0),
          total_received: fa.reduce((t: number, r: any) => t + Number(r.total_amount_paid ?? 0), 0),
          total_pending: fa.reduce((t: number, r: any) => t + Number(r.remaining_balance ?? 0), 0),
          pending_verification: fa.filter((r: any) => ["SUBMITTED", "UNDER_REVIEW", "UPDATED"].includes(r.status)).length,
          approved_count: fa.filter((r: any) => r.status === "APPROVED").length,
          rejected_count: fa.filter((r: any) => r.status === "REJECTED").length
        };
      } catch {
        s = {
          total_bookings: a.length,
          total_value: 0,
          total_received: 0,
          total_pending: 0,
          pending_verification: 0,
          approved_count: 0,
          rejected_count: 0
        };
      }
    }
  }

  const bookings = bookingsRes.data ?? [];
  const recentPayments = paymentsRes.data ?? [];
  const pendingUsers = pendingUsersRes.count ?? 0;

  // Names for "recorded by" — RLS hides other users from non-admin sessions.
  const dir = await resolveDirectory(recentPayments.map((p: any) => p.submitted_by));

  return (
    <>
      <PageHeader
        title={`Hello ${user.name.split(" ")[0]} 🖐️, `}
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
            <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[130px]" />
                  <col />
                  <col className="w-[120px]" />
                  <col className="hidden w-[120px] sm:table-column" />
                  <col className="hidden w-[130px] sm:table-column" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-slate-500 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Booking</th>
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 text-right font-medium">Value</th>
                    <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Paid</th>
                    <th className="hidden px-5 py-3 font-medium sm:table-cell">Status</th>
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
                      <td className="hidden px-5 py-3 text-right tabular-nums sm:table-cell">{formatINR(b.total_amount_paid)}</td>
                      <td className="hidden px-5 py-3 sm:table-cell"><StatusBadge status={b.status} /></td>
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
            <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto overscroll-contain">
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
