import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { reportMissedRecordAccess } from "@/lib/security/access-alert";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils/format";
import { resolveDirectory, displayUser } from "@/lib/utils/directory";
import AddPaymentForm from "@/components/payments/AddPaymentForm";
import ReviewActions from "@/components/bookings/ReviewActions";
import AddBookingCustomer from "@/components/bookings/AddBookingCustomer";
import InlineBookingEditor from "@/components/bookings/InlineBookingEditor";
import { BookingEditProvider } from "@/components/bookings/BookingEditProvider";
import HeaderEditControls from "@/components/bookings/HeaderEditControls";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import { ArrowRight, ChevronRight } from "lucide-react";
import ClickableRow from "@/components/ui/ClickableRow";
import BookingStatementPdfButton from "@/components/bookings/BookingStatementPdfButton";

export const dynamic = "force-dynamic";

export default async function BookingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { data: b } = await supabase
    .from("bookings")
    .select("*, customer:customer_id(title, name, father_spouse_name, date_of_birth, address, city, state, country, pin_code, phone, alternate_phone, email, alternate_email, pan_number, occupation, organization, designation)")
    .eq("id", id)
    .maybeSingle();
  if (!b) {
    // RLS returned nothing. That is either a booking that does not exist or
    // one belonging to another employee — only the second is a security event,
    // so this checks which before alerting the Directors.
    await reportMissedRecordAccess({
      table: "bookings",
      recordId: id,
      actor: user,
      path: `/bookings/${id}`
    });
    notFound();
  }
  const rawProject = (await cookies()).get("srivaraha_project")?.value ?? null;
  const projectId = rawProject && rawProject.trim() ? rawProject.trim() : null;
  // If the booking has a project_id but the cookie project differs,
  // don't redirect — the user explicitly opened this detail page.
  // Just continue loading; the page will show data scoped to the
  // booking's project via its own project_id (below).
  // Earlier redirection (project_mismatch) is only for the bookings/list pages.
  if (projectId && (b as any).project_id && (b as any).project_id !== projectId) {
    // removed redirect-to-list; keep page loaded for the detail view
  }

  // PostgREST types an embedded to-one relation as an array. (The old
  // select("*") was untyped `any`, which is why this only surfaced once the
  // columns were named explicitly.)
  const customer: any = Array.isArray(b.customer)
    ? (b.customer[0] ?? null)
    : (b.customer ?? null);

  // After ownership verified via RLS, read related rows with admin to show
  // SM the same payments/history the director sees. RLS would hide payments
  // submitted_by others and audit_logs (ADMIN/DIRECTOR only), causing the
  // "updated amount but not who updated" mismatch in your screenshots.
  const admin = createSupabaseAdmin();
  const [{ data: payments }, { data: history }, { data: bookingCustomers }] =
    await Promise.all([
      admin
        .from("payments")
        .select(
          "id, amount, payment_date, payment_mode, status, reference_no, submitted_by, reviewed_by",
        )
        .eq("booking_id", b.id)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("audit_logs")
        .select("id, action, reason, created_at, actor_user_id")
        .eq("entity_type", "booking")
        .eq("entity_id", b.id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("booking_customers")
        .select(
          "id, is_primary, customer:customer_id(title, name, father_spouse_name, date_of_birth, address, city, state, country, pin_code, phone, alternate_phone, email, alternate_email, pan_number, aadhaar_number, occupation, organization, designation)",
        )
        .eq("booking_id", b.id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
    ]);

  // One batched lookup for every user id referenced on this page.
  const dir = await resolveDirectory([
    b.created_by,
    ...(payments ?? []).flatMap((p: any) => [p.submitted_by, p.reviewed_by]),
    ...(history ?? []).map((h: any) => h.actor_user_id),
  ]);

  const canReview =
    ["ACCOUNTANT", "ADMIN", "DIRECTOR"].includes(user.role) &&
    ["SUBMITTED", "UNDER_REVIEW", "UPDATED"].includes(b.status);
  const canAddPayment = ["SM", "CP", "ADMIN", "DIRECTOR"].includes(user.role);
  const canEdit =
    ["ACCOUNTANT", "ADMIN", "DIRECTOR"].includes(user.role) &&
    ["SUBMITTED", "UNDER_REVIEW", "UPDATED"].includes(b.status);
  const people = (bookingCustomers ?? []).map((row: any) => ({
    ...row,
    customer: Array.isArray(row.customer)
      ? (row.customer[0] ?? null)
      : (row.customer ?? null),
  }));

  const editBooking = {
    id: b.id,
    project_name: b.project_name,
    unit_number: b.unit_number,
    property_details: b.property_details,
    total_property_value: b.total_property_value,
    notes: b.notes,
    booking_place: b.booking_place,
    booking_date: b.booking_date,
    block: b.block,
    facing: b.facing,
    sales_representative: (b as any).sales_representative,
    team_manager: (b as any).team_manager,
    saleable_area: (b as any).saleable_area,
    carpet_area: (b as any).carpet_area,
    external_walls_area: (b as any).external_walls_area,
    balcony_utility_area: (b as any).balcony_utility_area,
    common_area: (b as any).common_area,
    sale_consideration_per_sqft: (b as any).sale_consideration_per_sqft,
    source_of_booking: (b as any).source_of_booking,
    payment_source: (b as any).payment_source,
    purchase_purpose: (b as any).purchase_purpose,
    cp_agent_name: (b as any).cp_agent_name,
    cp_rera_id: (b as any).cp_rera_id,
  };

  return (
    <BookingEditProvider booking={editBooking}>
      <div className="sticky -top-6 z-30 -mx-3 sm:-mx-6 xl:-mx-8 -mt-6 border-b border-slate-200 bg-white px-3 sm:px-6 xl:px-8 py-3 shadow-sm isolate">
        <PageHeader
          compact
          className="py-1"
          title={b.booking_id}
          description={`${b.project_name} · Unit ${b.unit_number}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/bookings" className="btn-secondary h-9">
                Back
              </Link>
              <BookingStatementPdfButton
                bookingRef={b.booking_id}
                project={b.project_name}
                subProjectName={(b as any).block ? `BLOCK ${(b as any).block}` : (b as any).sub_project_name ?? b.project_name}
                unit={b.unit_number}
                sft={(b as any).saleable_area ?? (b as any).carpet_area ?? ""}
                bookingDate={(b as any).booking_date ?? b.created_at}
                customerName={people[0]?.customer?.name ?? customer?.name ?? "Customer"}
                coApplicantName={people.find((pe: any) => !pe.is_primary)?.customer?.name ?? null}
                totalValue={Number(b.total_property_value ?? 0)}
                totalPaid={Number(b.total_amount_paid ?? 0)}
                remaining={Number(b.remaining_balance ?? 0)}
                receipts={(payments ?? []).map((p: any, idx: number) => ({
                  no: `${idx + 322} / ${p.id.slice(0, 6)}`,
                  date: formatDate(p.payment_date),
                  mode: p.payment_mode,
                  bankName: p.payment_mode === "BANK_TRANSFER" ? "Online Payment" : p.payment_mode,
                  instrumentDate: formatDate(p.payment_date),
                  instrumentNo: p.reference_no ? `BY TRANSFER-RTGS UTR NO: ${p.reference_no}` : "BY TRANSFER-RTGS UTR NO: HD",
                  amount: Number(p.amount ?? 0),
                  ref: p.reference_no ?? undefined,
                }))}
              />
              {canEdit && <HeaderEditControls />}
              <StatusBadge status={b.status} />
            </div>
          }
        />
      </div>

      <div className="relative isolate -mx-3 sm:-mx-6 xl:-mx-8 px-3 sm:px-6 xl:px-8 grid gap-4 xl:grid-cols-3 items-start pt-6">
        <div className="xl:col-span-2 space-y-4 min-w-0">
            <CollapsibleCard title="Financial">
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Total value" value={formatINR(b.total_property_value)} />
                <Stat label="Total paid" value={formatINR(b.total_amount_paid)} tone="emerald" />
                <Stat label="Remaining" value={formatINR(b.remaining_balance)} tone="amber" />
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Customers" right={canAddPayment ? <AddBookingCustomer bookingId={b.id} /> : undefined}>
              <div className="space-y-3">
                {(people.length
                  ? people
                  : [{ id: "primary", is_primary: true, customer }]
                ).map((person: any, index: number) => (
                  <div
                    key={person.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {person.is_primary || index === 0
                        ? "Primary customer"
                        : `Additional customer ${index + 1}`}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <Info label="Name" value={person.customer?.name ?? "—"} />
                      <Info
                        label="Title / relation"
                        value={
                          [
                            person.customer?.title,
                            person.customer?.father_spouse_name,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"
                        }
                      />
                      <Info
                        label="Phone"
                        value={person.customer?.phone ?? "—"}
                      />
                      <Info
                        label="Email"
                        value={person.customer?.email ?? "—"}
                      />
                      <Info
                        label="Date of birth"
                        value={person.customer?.date_of_birth ?? "—"}
                      />
                      <Info
                        label="Alternate contact"
                        value={
                          [
                            person.customer?.alternate_phone,
                            person.customer?.alternate_email,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"
                        }
                      />
                      <Info
                        label="Address"
                        value={
                          [
                            person.customer?.address,
                            person.customer?.city,
                            person.customer?.state,
                            person.customer?.pin_code,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"
                        }
                        span
                      />
                      <Info
                        label="PAN / Aadhaar"
                        value={
                          [
                            person.customer?.pan_number,
                            person.customer?.aadhaar_number,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"
                        }
                      />
                      <Info
                        label="Occupation"
                        value={
                          [
                            person.customer?.occupation,
                            person.customer?.organization,
                            person.customer?.designation,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleCard>

            <InlineBookingEditor booking={editBooking} />

            {(b.bank_name || b.bank_account_number || b.loan_sanctioned) && (
              <CollapsibleCard title="Bank details">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Info label="Bank" value={b.bank_name ?? "—"} />
                  <Info label="Branch" value={b.bank_branch ?? "—"} />
                  <Info
                    label="Account holder"
                    value={b.bank_account_holder ?? "—"}
                  />
                  <Info
                    label="Account number"
                    value={b.bank_account_number ?? "—"}
                  />
                  <Info label="IFSC" value={b.bank_ifsc ?? "—"} />
                  <Info
                    label="Home loan"
                    value={
                      b.loan_sanctioned
                        ? `Sanctioned${b.loan_amount ? " · " + formatINR(b.loan_amount) : ""}`
                        : "Not sanctioned"
                    }
                  />
                </div>
              </CollapsibleCard>
            )}

            <CollapsibleCard title="Payment history" right={<span className="text-xs text-slate-500">{payments?.length ?? 0} entries</span>}>
              {(payments?.length ?? 0) === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No payments recorded.
                </div>
              ) : (
                <div className="max-h-[232px] overflow-y-auto overflow-x-auto overscroll-contain">
                  {/*
                  table-fixed + colgroup: without explicit widths the review
                  buttons pushed the table past the card and clipped the last
                  column. Verification lives in the Verification Queue and on
                  the payment page — this table is a read-only ledger.
                  Capped to 4 rows (~58px each) + header so scrollbar appears after 4 entries.
                */}
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-[72px]" />
                      <col className="w-[130px]" />
                      <col className="w-[110px]" />
                      <col className="w-[130px]" />
                      <col className="w-[120px]" />
                      <col />
                      <col className="w-[44px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-[1] bg-slate-50 text-slate-500 text-left shadow-[0_1px_0_#e2e8f0]">
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Amount
                        </th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Mode</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Submitted by</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {payments!.map((p: any, i: number) => (
                        <ClickableRow
                          key={p.id}
                          href={`/payments/${p.id}`}
                          className="row-hover border-t border-border"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/payments/${p.id}`}
                              className="font-medium text-slate-900 hover:text-accent"
                            >
                              #{payments!.length - i}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {formatINR(p.amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(p.payment_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="cell-truncate text-slate-600">
                              {p.payment_mode.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="cell-truncate text-slate-600">
                              {displayUser(dir, p.submitted_by)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        </ClickableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="History">
              {(history?.length ?? 0) === 0 ? (
                <div className="text-sm text-slate-500">No activity yet.</div>
              ) : (
                <ol className="space-y-3">
                  {history!.map((h: any) => (
                    <li key={h.id} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
                      <div className="text-sm">
                        <div className="text-slate-900">
                          <span className="font-medium">
                            {h.actor_user_id
                              ? displayUser(dir, h.actor_user_id)
                              : "System"}
                          </span>{" "}
                          · {h.action.replaceAll("_", " ").toLowerCase()}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(h.created_at)}
                          {h.reason ? ` · ${h.reason}` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CollapsibleCard>
          </div>

          <aside className="space-y-4 self-start min-w-0 pb-8 xl:sticky xl:top-[84px]">
           {canAddPayment && (
  <div className="rounded-xl border border-border bg-white">
    <div className="px-4 py-3 font-semibold text-slate-900">
      Add payment
    </div>
    <div className="p-4">
      <AddPaymentForm
        bookingId={b.id}
        maxAmount={b.remaining_balance}
        totalPaid={b.total_amount_paid}
      />
    </div>
  </div>
)}

<div className="rounded-xl border border-border bg-white">
  <div className="px-4 py-3 font-semibold text-slate-900">
    Submission
  </div>
  <div className="p-4">
    <dl className="space-y-2 text-sm">
      <Info
        label="Submitted by"
        value={displayUser(dir, b.created_by, { withRole: true })}
      />
      <Info
        label="Submitted at"
        value={formatDateTime(b.submitted_at)}
      />
      <Info
        label="Last updated"
        value={formatDateTime(b.updated_at)}
      />

      {b.rejection_reason && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          <div className="font-medium">Rejection reason</div>
          <div>{b.rejection_reason}</div>
        </div>
      )}
    </dl>
  </div>
</div>
          </aside>
        </div>
    </BookingEditProvider>
  );
}

function Info({
  label,
  value,
  span,
}: {
  label: string;
  value: React.ReactNode;
  span?: boolean;
}) {
  return (
    // min-w-0 + break-words: without these a long unbroken property_details
    // string forces the grid column wide and blows out the card.
    <div className={`min-w-0 ${span ? "col-span-2" : ""}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 break-words text-slate-900">{value}</div>
    </div>
  );
}
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber";
}) {
  const c =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-slate-900";
  return (
    <div className="rounded-xl border border-border p-4 overflow-hidden">
      <div className="text-xs text-slate-500 truncate">{label}</div>
      <div className={`mt-1 text-lg sm:text-xl font-semibold tabular-nums truncate whitespace-nowrap ${c}`} title={value}>
        {value}
      </div>
    </div>
  );
}
