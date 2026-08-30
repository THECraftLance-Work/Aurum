import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import Tooltip from "@/components/ui/Tooltip";
import { formatDate, formatINR } from "@/lib/utils/format";
import BookingsFilters from "@/components/bookings/BookingsFilters";
import ClickableRow from "@/components/ui/ClickableRow";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function BookingsPage({
  searchParams
}: { searchParams: Promise<{ status?: string; q?: string; customer?: string; page?: string }> }) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const filters = await searchParams;

  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_id, project_name, unit_number, total_property_value, total_amount_paid, remaining_balance, status, created_at, customer:customer_id(name, phone)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (["SM", "CP"].includes(user.role)) query = query.eq("created_by", user.id);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.customer) query = query.eq("customer_id", filters.customer);
  if (filters.q) {
    // Strip characters that terminate or re-parse a PostgREST or() group:
    // %, comma, parentheses, dot and backslash. Without this a query like
    // "A-1)" produces a malformed filter and a 400.
    const term = `%${filters.q.replace(/[%,()\.]/g, " ").trim()}%`;
    query = query.or(`booking_id.ilike.${term},project_name.ilike.${term},unit_number.ilike.${term}`);
  }

  const { data: bookings, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (filters.status) sp.set("status", filters.status);
    if (filters.q) sp.set("q", filters.q);
    if (filters.customer) sp.set("customer", filters.customer);
    sp.set("page", String(p));
    return `/bookings?${sp.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Customer bookings, financial totals, and their verification status."
        actions={
          ["SM", "CP", "ADMIN", "DIRECTOR"].includes(user.role) && (
            <Link href="/bookings/new" className="btn-primary h-10">
              <Plus className="h-4 w-4" /> New booking
            </Link>
          )
        }
      />

      <BookingsFilters />

      {/* min-w-0 lets this shrink inside the flex column, so the inner
          overflow-x-auto actually scrolls instead of pushing the page wide. */}
      <div className="card min-w-0 overflow-hidden p-0">
        {(!bookings || bookings.length === 0) ? (
          <EmptyState title="No bookings found" description="Try adjusting filters or create a new booking." />
        ) : (
          <>
            {/* Desktop: fixed-layout table so a long unbroken string truncates
                instead of blowing out the column widths. */}
            <div className="hidden max-h-[calc(100vh-250px)] overflow-auto overscroll-contain sm:block">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[120px]" />
                  <col className="w-[180px]" />
                  <col className="w-[200px]" />
                  <col className="w-[130px]" />
                  <col className="w-[130px]" />
                  <col className="w-[130px]" />
                  <col className="w-[140px]" />
                  <col className="w-[110px]" />
                </colgroup>
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Booking</th>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Project · Unit</th>
                    <th className="px-5 py-3 text-right font-medium">Value</th>
                    <th className="px-5 py-3 text-right font-medium">Paid</th>
                    <th className="px-5 py-3 text-right font-medium">Pending</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b: any) => (
                    <ClickableRow key={b.id} href={`/bookings/${b.id}`} className="row-hover border-t border-border">
                      <td className="px-5 py-3">
                        <Link href={`/bookings/${b.id}`} className="cell-truncate font-medium text-slate-900 hover:text-accent">
                          {b.booking_id}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Tooltip className="block" label={b.customer?.name}>
                          <span className="cell-truncate text-slate-900">{b.customer?.name ?? "—"}</span>
                        </Tooltip>
                        <span className="cell-truncate text-xs text-slate-500">{b.customer?.phone ?? ""}</span>
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
                      <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{formatINR(b.total_amount_paid)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-amber-700">{formatINR(b.remaining_balance)}</td>
                      <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(b.created_at)}</td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards rather than a shrunken table. */}
            <ul className="max-h-[calc(100vh-250px)] divide-y divide-border overflow-y-auto overscroll-contain sm:hidden">
              {bookings.map((b: any) => (
                <li key={b.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/bookings/${b.id}`} className="min-w-0 font-medium text-slate-900">
                      <span className="block truncate">{b.booking_id}</span>
                      <span className="block truncate text-xs font-normal text-slate-500">{b.customer?.name ?? "—"}</span>
                    </Link>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-2 truncate text-sm text-slate-600">{b.project_name} · Unit {b.unit_number}</div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-slate-500">Value</dt><dd className="tabular-nums font-medium">{formatINR(b.total_property_value)}</dd></div>
                    <div><dt className="text-slate-500">Paid</dt><dd className="tabular-nums font-medium text-emerald-700">{formatINR(b.total_amount_paid)}</dd></div>
                    <div><dt className="text-slate-500">Pending</dt><dd className="tabular-nums font-medium text-amber-700">{formatINR(b.remaining_balance)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
                <span className="text-slate-500">
                  {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex gap-2">
                  {page > 1 && <Link href={pageHref(page - 1)} className="btn-secondary h-8 text-xs">Previous</Link>}
                  {page < totalPages && <Link href={pageHref(page + 1)} className="btn-secondary h-8 text-xs">Next</Link>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
