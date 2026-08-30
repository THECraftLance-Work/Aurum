import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils/format";
import { resolveDirectory, displayUser } from "@/lib/utils/directory";
import AddPaymentForm from "@/components/payments/AddPaymentForm";
import ReviewActions from "@/components/bookings/ReviewActions";
import AddBookingCustomer from "@/components/bookings/AddBookingCustomer";
import EditBookingButton from "@/components/bookings/EditBookingButton";
import { ArrowRight, ChevronRight } from "lucide-react";
import ClickableRow from "@/components/ui/ClickableRow";

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
    .select("*, customer:customer_id(name, phone, email)")
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();

  // PostgREST types an embedded to-one relation as an array. (The old
  // select("*") was untyped `any`, which is why this only surfaced once the
  // columns were named explicitly.)
  const customer: any = Array.isArray(b.customer)
    ? (b.customer[0] ?? null)
    : (b.customer ?? null);

  // These two have no dependency on each other, so run them together rather
  // than paying two sequential round-trips.
  const [{ data: payments }, { data: history }, { data: bookingCustomers }] =
    await Promise.all([
      supabase
        .from("payments")
        .select(
          "id, amount, payment_date, payment_mode, status, reference_no, submitted_by, reviewed_by",
        )
        .eq("booking_id", b.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("audit_logs")
        .select("id, action, reason, created_at, actor_user_id")
        .eq("entity_type", "booking")
        .eq("entity_id", b.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
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

  return (
    <>
      <PageHeader
        title={b.booking_id}
        description={`${b.project_name} · Unit ${b.unit_number}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/bookings" className="btn-secondary h-10">
              Back
            </Link>
            {canEdit && (
              <EditBookingButton
                booking={{
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
                }}
              />
            )}
            <StatusBadge status={b.status} />
          </div>
        }
      />

      <div className="h-[calc(100vh-175px)] overflow-y-auto overscroll-contain pr-1">
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Customers
                </h3>
                {canAddPayment && <AddBookingCustomer bookingId={b.id} />}
              </div>
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
            </div>

            <div className="card p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">
                Booking form details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info
                  label="Sales representative"
                  value={b.sales_representative ?? "—"}
                />
                <Info label="Team manager" value={b.team_manager ?? "—"} />
                <Info label="Booking place" value={b.booking_place ?? "—"} />
                <Info label="Booking date" value={b.booking_date ?? "—"} />
                <Info label="Block" value={b.block ?? "—"} />
                <Info label="Facing" value={b.facing ?? "—"} />
                <Info
                  label="Saleable area"
                  value={b.saleable_area ? `${b.saleable_area} Sq.ft` : "—"}
                />
                <Info
                  label="Carpet area"
                  value={b.carpet_area ? `${b.carpet_area} Sq.ft` : "—"}
                />
                <Info
                  label="External walls area"
                  value={
                    b.external_walls_area
                      ? `${b.external_walls_area} Sq.ft`
                      : "—"
                  }
                />
                <Info
                  label="Balcony & utility area"
                  value={
                    b.balcony_utility_area
                      ? `${b.balcony_utility_area} Sq.ft`
                      : "—"
                  }
                />
                <Info
                  label="Common area"
                  value={b.common_area ? `${b.common_area} Sq.ft` : "—"}
                />
                <Info
                  label="Sale consideration / Sq.ft"
                  value={
                    b.sale_consideration_per_sqft
                      ? formatINR(b.sale_consideration_per_sqft)
                      : "—"
                  }
                />
                <Info
                  label="Source of booking"
                  value={b.source_of_booking ?? "—"}
                />
                <Info label="Payment source" value={b.payment_source ?? "—"} />
                <Info
                  label="Purpose of purchase"
                  value={b.purchase_purpose ?? "—"}
                />
                <Info
                  label="CP / referral"
                  value={
                    [b.cp_agent_name, b.cp_rera_id]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                />
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Property
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="Project" value={b.project_name} />
                <Info label="Unit" value={b.unit_number} />
                <Info label="Details" value={b.property_details ?? "—"} span />
              </div>
            </div>

            {(b.bank_name || b.bank_account_number || b.loan_sanctioned) && (
              <div className="card p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Bank details
                </h3>
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
              </div>
            )}

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Financial
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Stat
                  label="Total value"
                  value={formatINR(b.total_property_value)}
                />
                <Stat
                  label="Total paid"
                  value={formatINR(b.total_amount_paid)}
                  tone="emerald"
                />
                <Stat
                  label="Remaining"
                  value={formatINR(b.remaining_balance)}
                  tone="amber"
                />
              </div>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Payment history
                </h3>
                <span className="text-xs text-slate-500">
                  {payments?.length ?? 0} entries
                </span>
              </div>
              {(payments?.length ?? 0) === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No payments recorded.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/*
                  table-fixed + colgroup: without explicit widths the review
                  buttons pushed the table past the card and clipped the last
                  column. Verification lives in the Verification Queue and on
                  the payment page — this table is a read-only ledger.
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
                    <thead className="bg-slate-50 text-slate-500 text-left">
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
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                History
              </h3>
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
            </div>
          </div>

          <aside className="space-y-4 self-start xl:sticky xl:top-0 xl:max-h-[calc(100vh-100px)] xl:overflow-y-auto xl:overscroll-contain">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Submission
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
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

            {canReview && <ReviewActions bookingId={b.id} />}

            {canAddPayment && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Add payment
                </h3>
                <AddPaymentForm
                  bookingId={b.id}
                  maxAmount={b.remaining_balance}
                  totalPaid={b.total_amount_paid}
                />
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
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
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>
        {value}
      </div>
    </div>
  );
}
