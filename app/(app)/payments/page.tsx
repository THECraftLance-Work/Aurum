import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import Tooltip from "@/components/ui/Tooltip";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { resolveDirectory, displayUser } from "@/lib/utils/directory";
import { ChevronRight } from "lucide-react";
import ClickableRow from "@/components/ui/ClickableRow";
import TabNav from "@/components/ui/TabNav";
import BookingFilter from "@/components/payments/BookingFilter";
import { getProjectScopeIds } from "@/lib/utils/projectScope";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const TABS = [
  { key: "ALL", label: "All", statuses: [] as string[] },
  {
    key: "PENDING",
    label: "Awaiting verification",
    statuses: ["PENDING", "UNDER_REVIEW"],
  },
  { key: "APPROVED", label: "Approved", statuses: ["APPROVED"] },
  { key: "REJECTED", label: "Rejected", statuses: ["REJECTED"] },
];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; booking?: string; plan?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const filters = await searchParams;
  const rawProject = (await cookies()).get("srivaraha_project")?.value ?? null;
  const projectId = rawProject && rawProject.trim() ? rawProject.trim() : null;
  const scopeIds = await getProjectScopeIds(supabase, projectId);

  const tab =
    TABS.find((t) => t.key === (filters.tab ?? "ALL")) ?? TABS[0];
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // Only the columns the table renders — the old `select("*")` pulled notes,
  // rejection_reason and every timestamp for 200 rows to show six of them.
  let q = supabase
    .from("payments")
    .select(
      "id, amount, payment_date, created_at, payment_mode, status, booking_id, submitted_by, project_id, reference_no, booking:booking_id(booking_id, project_name, total_property_value)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (!filters.plan || filters.plan === "all") {
    q = q.range(from, from + PAGE_SIZE - 1);
  } else {
    // Plan classification uses the booking total, so it cannot be expressed
    // as a reliable PostgREST predicate. Fetch the scoped set, classify it,
    // then paginate the filtered result instead of filtering one page only.
    q = q.limit(1000);
  }

  if (["SM", "CP"].includes(user.role)) q = q.eq("submitted_by", user.id);
  if (tab.statuses.length) q = q.in("status", tab.statuses);
  if (scopeIds) q = q.in("project_id", scopeIds);
  if (filters.booking) q = q.eq("booking_id", filters.booking);

  // For booking filter dropdown — project-scoped
  let bFilterQ: any = supabase.from("bookings").select("id, booking_id").order("created_at", { ascending: false }).limit(100);
  if (["SM","CP"].includes(user.role)) bFilterQ = bFilterQ.eq("created_by", user.id);
  if (scopeIds) bFilterQ = bFilterQ.in("project_id", scopeIds);
  const { data: filterBookings } = await bFilterQ;

  const { data: rawPayments, count } = await q;

  // Filter by payment plan (One-Time vs Installment) if selected
  const filteredPayments = (rawPayments ?? []).filter((p: any) => {
    if (!filters.plan || filters.plan === "all") return true;
    const isOneTime = Number(p.amount) >= Number(p.booking?.total_property_value ?? 0) || p.reference_no === "ONE_TIME" || p.reference_no === "FULL_PAYMENT";
    if (filters.plan === "one_time") return isOneTime;
    if (filters.plan === "installment") return !isOneTime;
    return true;
  });

  const payments = filters.plan && filters.plan !== "all"
    ? filteredPayments.slice(from, from + PAGE_SIZE)
    : filteredPayments;
  const total = filters.plan && filters.plan !== "all" ? filteredPayments.length : (count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dir = await resolveDirectory(
    (payments ?? []).map((p: any) => p.submitted_by),
  );

  const href = (over: Record<string, string>) => {
    const sp = new URLSearchParams();
    sp.set("tab", over.tab ?? tab.key);
    if (over.page) sp.set("page", over.page);
    if (over.plan ?? filters.plan) sp.set("plan", over.plan ?? filters.plan!);
    if (over.booking ?? filters.booking) sp.set("booking", over.booking ?? filters.booking!);
    return `/payments?${sp.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every payment entry and its verification status. Open one for the full transaction record."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <TabNav
            tabs={TABS.map((t) => ({
              key: t.key,
              label: t.label,
              href: href({ tab: t.key }),
            }))}
            active={tab.key}
          />
          {/* One-time vs Installment filter */}
          <div className="flex items-center rounded-xl border border-border bg-white p-1 text-xs font-medium shadow-sm">
            <Link
              href={href({ plan: "all" })}
              className={cn("px-2.5 py-1 rounded-lg transition", (!filters.plan || filters.plan === "all") ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:text-slate-900")}
            >
              All Types
            </Link>
            <Link
              href={href({ plan: "one_time" })}
              className={cn("px-2.5 py-1 rounded-lg transition", filters.plan === "one_time" ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:text-slate-900")}
            >
              One-time
            </Link>
            <Link
              href={href({ plan: "installment" })}
              className={cn("px-2.5 py-1 rounded-lg transition", filters.plan === "installment" ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:text-slate-900")}
            >
              Installment
            </Link>
          </div>
        </div>
        <BookingFilter bookings={filterBookings ?? []} current={filters.booking} />
      </div>

      <div className="card min-w-0 overflow-hidden p-0">
        {!payments || payments.length === 0 ? (
          <EmptyState
            title="No payments here"
            description={
              tab.key === "PENDING"
                ? "Nothing is waiting on verification."
                : "Payments appear here once submitted."
            }
          />
        ) : (
          <>
            <div className="hidden min-h-0 max-h-[calc(100vh-280px)] overflow-auto overscroll-contain sm:block">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[170px]" />
                  <col />
                  <col className="w-[140px]" />
                  <col className="w-[120px]" />
                  <col className="w-[140px]" />
                  <col className="w-[160px]" />
                  <col className="w-[140px]" />
                  <col className="w-[44px]" />
                </colgroup>

                <thead className="bg-slate-50 text-center   text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap text-right  px-5 py-3 font-medium">
                      Booking
                    </th>

                    <th className="px-5 py-3 text-left font-medium">Project</th>

                    <th className="px-5 py-3 text-right font-medium">Amount</th>

                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Date
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Mode
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Status
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Recorded by
                    </th>

                    <th className="w-[44px] px-5 py-3" />
                  </tr>
                </thead>

                <tbody>
                  {payments.map((p: any) => {
                    const bk = Array.isArray(p.booking)
                      ? p.booking[0]
                      : p.booking;

                    return (
                      <ClickableRow
                        key={p.id}
                        href={`/payments/${p.id}`}
                        className="row-hover border-t border-border"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/payments/${p.id}`}
                            className="cell-truncate block font-medium text-slate-900 hover:text-accent"
                          >
                            {bk?.booking_id ?? "Unknown"}
                          </Link>
                        </td>

                        <td className="min-w-0 px-5 py-3">
                          <Tooltip className="block" label={bk?.project_name}>
                            <span className="cell-truncate block text-slate-600">
                              {bk?.project_name ?? "Unknown"}
                            </span>
                          </Tooltip>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums">
                          {formatINR(p.amount)}
                        </td>

                        <td className="px-5 py-3 text-slate-600">
                          <span className="block whitespace-nowrap">{formatDate(p.payment_date)}</span>
                          <span className="mt-0.5 block whitespace-nowrap text-xs text-slate-400">
                            Added {formatDateTime(p.created_at)}
                          </span>
                        </td>

                        <td className="min-w-0 px-4 py-5 text-slate-600">
                          <span className="cell-truncate block whitespace-nowrap capitalize">
                            {p.payment_mode.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td className="px-5 py-3">
                          <StatusBadge status={p.status} />
                        </td>

                        <td className="min-w-0 px-5 py-3 text-slate-600">
                          <span className="cell-truncate block">
                            {displayUser(dir, p.submitted_by)}
                          </span>
                        </td>

                        <td className="px-5 py-3">
                          <Link
                            href={`/payments/${p.id}`}
                            aria-label="Open payment"
                            className="flex items-center justify-center text-slate-400 hover:text-accent"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: a transaction list, closer to how a payments app reads */}
            <ul className="max-h-[calc(100vh-280px)] divide-y divide-border overflow-y-auto overscroll-contain sm:hidden">
              {payments.map((p: any) => {
                const bk = Array.isArray(p.booking) ? p.booking[0] : p.booking;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/payments/${p.id}`}
                      className="flex items-center gap-3 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-900">
                          {bk?.booking_id ?? "—"}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {formatDate(p.payment_date)} · Added {formatDateTime(p.created_at)} ·{" "}
                          {p.payment_mode.replaceAll("_", " ")}
                        </div>
                        <div className="mt-1">
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-semibold tabular-nums text-slate-900">
                        {formatINR(p.amount)}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
                <span className="text-slate-500">
                  {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={href({ page: String(page - 1) })}
                      className="btn-secondary h-8 text-xs"
                    >
                      Previous
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={href({ page: String(page + 1) })}
                      className="btn-secondary h-8 text-xs"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
