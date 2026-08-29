import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import Tooltip from "@/components/ui/Tooltip";
import PaymentReviewActions from "@/components/payments/PaymentReviewActions";
import { formatDate, formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { resolveDirectory, displayUser } from "@/lib/utils/directory";
import ClickableRow from "@/components/ui/ClickableRow";
import TabNav from "@/components/ui/TabNav";

export const dynamic = "force-dynamic";

/**
 * Bookings and payments are verified independently.
 *
 * The Payments tab exists because payment approval used to ride entirely on
 * booking approval. Once a booking was APPROVED it left the pending list, so a
 * second payment added to it was invisible here and could never be actioned —
 * it sat in PENDING forever and was excluded from the booking's paid total.
 */
const BOOKING_TABS = [
  { key: "PENDING", label: "Bookings", statuses: ["SUBMITTED", "UNDER_REVIEW", "UPDATED"] },
  { key: "APPROVED", label: "Approved", statuses: ["APPROVED"] },
  { key: "REJECTED", label: "Rejected", statuses: ["REJECTED"] }
];

export default async function VerificationPage({
  searchParams
}: { searchParams: { tab?: string } }) {
  await requireRole(["ACCOUNTANT", "ADMIN", "DIRECTOR"]);
  const supabase = createSupabaseServer();
  const activeKey = searchParams.tab ?? "PAYMENTS";
  const bookingTab = BOOKING_TABS.find((t) => t.key === activeKey);

  // The pending-payment count drives the tab badge, so it's always fetched.
  const pendingPaymentsQuery = supabase
    .from("payments")
    .select(
      "id, amount, payment_date, payment_mode, reference_no, status, created_at, booking_id, submitted_by, booking:booking_id(id, booking_id, project_name, unit_number)",
      { count: "exact" }
    )
    .in("status", ["PENDING", "UNDER_REVIEW"])
    .order("created_at", { ascending: true })
    .limit(100);

  const bookingsQuery = bookingTab
    ? supabase
        .from("bookings")
        .select("id, booking_id, project_name, unit_number, total_property_value, total_amount_paid, status, submitted_at, created_by, customer:customer_id(name)")
        .in("status", bookingTab.statuses)
        .order("submitted_at", { ascending: false })
        .limit(100)
    : Promise.resolve({ data: [] as any[] } as any);

  const [payRes, bookRes] = await Promise.all([pendingPaymentsQuery, bookingsQuery]);
  const pendingPayments = payRes.data ?? [];
  const pendingCount = payRes.count ?? 0;
  const bookings = (bookRes as any).data ?? [];

  const dir = await resolveDirectory([
    ...pendingPayments.map((p: any) => p.submitted_by),
    ...bookings.map((b: any) => b.created_by)
  ]);

  const tabs = [
    { key: "PAYMENTS", label: "Payments", badge: pendingCount },
    ...BOOKING_TABS.map((t) => ({ key: t.key, label: t.label, badge: null as number | null }))
  ];

  return (
    <>
      <PageHeader
        title="Verification queue"
        description="Bookings and payments are verified independently — a payment on an already-approved booking still needs sign-off."
      />

      <TabNav
        tabs={tabs}
        active={activeKey}
        hrefFor={(k) => `/verification?tab=${k}`}
      />

      {activeKey === "PAYMENTS" ? (
        <div className="card min-w-0 overflow-hidden p-0">
          {pendingPayments.length === 0 ? (
            <EmptyState title="No payments awaiting verification" description="Every recorded payment has been actioned." />
          ) : (
            <ul className="divide-y divide-border">
              {pendingPayments.map((p: any) => {
                const bk = Array.isArray(p.booking) ? p.booking[0] : p.booking;
                                return (
                  <li key={p.id} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/payments/${p.id}`} className="font-semibold text-slate-900 hover:text-accent">
                            {formatINR(p.amount)}
                          </Link>
                          <StatusBadge status={p.status} />
                          <span className="text-xs text-slate-500">
                            {p.payment_mode.replaceAll("_", " ")} · {formatDate(p.payment_date)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm text-slate-600">
                          <Link href={`/bookings/${bk?.id}`} className="font-medium text-slate-900 hover:underline">
                            {bk?.booking_id ?? "—"}
                          </Link>
                          {bk?.project_name ? ` · ${bk.project_name} · Unit ${bk.unit_number}` : ""}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          Recorded by {displayUser(dir, p.submitted_by, { withRole: true })}
                          {p.reference_no ? ` · Ref ${p.reference_no}` : ""}
                        </div>
                      </div>
                      <div className="w-full shrink-0 lg:w-80">
                        <PaymentReviewActions
                          paymentId={p.id}
                          amount={Number(p.amount)}
                          bookingRef={bk?.booking_id ?? ""}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="card min-w-0 overflow-hidden p-0">
          {bookings.length === 0 ? (
            <EmptyState title="Nothing to review" description="Newly submitted bookings will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[130px]" /><col className="w-[160px]" /><col className="w-[160px]" />
                  <col /><col className="w-[140px]" /><col className="w-[140px]" />
                  <col className="w-[140px]" /><col className="w-[120px]" />
                </colgroup>
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Booking</th>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Submitted by</th>
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 text-right font-medium">Value</th>
                    <th className="px-5 py-3 text-right font-medium">Paid</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b: any) => {
                    const cust = Array.isArray(b.customer) ? b.customer[0] : b.customer;
                    return (
                      <ClickableRow key={b.id} href={`/bookings/${b.id}`} className="row-hover border-t border-border">
                        <td className="px-5 py-3">
                          <Link href={`/bookings/${b.id}`} className="cell-truncate font-medium text-slate-900 hover:text-accent">
                            {b.booking_id}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <Tooltip className="block" label={cust?.name}>
                            <span className="cell-truncate">{cust?.name ?? "—"}</span>
                          </Tooltip>
                        </td>
                        <td className="px-5 py-3">
                          <span className="cell-truncate text-slate-900">{displayUser(dir, b.created_by)}</span>
                        </td>
                        <td className="px-5 py-3">
                          <Tooltip className="block" label={b.project_name}>
                            <span className="cell-truncate text-slate-900">{b.project_name}</span>
                          </Tooltip>
                          <span className="cell-truncate text-xs text-slate-500">Unit {b.unit_number}</span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatINR(b.total_property_value)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{formatINR(b.total_amount_paid)}</td>
                        <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                        <td className="px-5 py-3 text-slate-500">{formatDate(b.submitted_at)}</td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
