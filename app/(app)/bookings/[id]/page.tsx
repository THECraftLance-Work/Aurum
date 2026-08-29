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
import AttachmentList from "@/components/bookings/AttachmentList";
import PaymentReviewActions from "@/components/payments/PaymentReviewActions";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BookingDetail({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();

  const { data: b } = await supabase
    .from("bookings")
    .select("id, booking_id, project_name, unit_number, property_details, total_property_value, total_amount_paid, remaining_balance, status, submitted_at, updated_at, rejection_reason, bank_name, bank_account_holder, bank_account_number, bank_ifsc, bank_branch, loan_sanctioned, loan_amount, created_by, customer:customer_id(name, phone, email)")
    .eq("id", params.id)
    .maybeSingle();
  if (!b) notFound();

  // PostgREST types an embedded to-one relation as an array. (The old
  // select("*") was untyped `any`, which is why this only surfaced once the
  // columns were named explicitly.)
  const customer: any = Array.isArray(b.customer) ? b.customer[0] ?? null : b.customer ?? null;


  // These two have no dependency on each other, so run them together rather
  // than paying two sequential round-trips.
  const [{ data: payments }, { data: history }, { data: attachments }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, payment_date, payment_mode, status, reference_no, submitted_by, reviewed_by")
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
      .from("attachments")
      .select("id, file_name, file_size, mime_type, storage_path, label, created_at, uploader:uploaded_by(name)")
      .eq("entity_type", "booking")
      .eq("entity_id", b.id)
      .order("created_at", { ascending: false })
  ]);

  // One batched lookup for every user id referenced on this page.
  const dir = await resolveDirectory([
    b.created_by,
    ...(payments ?? []).flatMap((p: any) => [p.submitted_by, p.reviewed_by]),
    ...(history ?? []).map((h: any) => h.actor_user_id)
  ]);

  const canReview = ["ACCOUNTANT","ADMIN","DIRECTOR"].includes(user.role) && ["SUBMITTED","UNDER_REVIEW","UPDATED"].includes(b.status);
  const canAddPayment = ["SM","CP","ADMIN","DIRECTOR"].includes(user.role);
  const canReviewPayments = ["ACCOUNTANT","ADMIN","DIRECTOR"].includes(user.role);

  return (
    <>
      <PageHeader
        title={b.booking_id}
        description={`${b.project_name} · Unit ${b.unit_number}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/bookings" className="btn-secondary h-10">Back</Link>
            <StatusBadge status={b.status} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Customer</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Name"  value={customer?.name ?? "—"} />
              <Info label="Phone" value={customer?.phone ?? "—"} />
              <Info label="Email" value={customer?.email ?? "—"} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Property</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Project"    value={b.project_name} />
              <Info label="Unit"       value={b.unit_number} />
              <Info label="Details"    value={b.property_details ?? "—"} span />
            </div>
          </div>

          {(b.bank_name || b.bank_account_number || b.loan_sanctioned) && (
            <div className="card p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Bank details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="Bank" value={b.bank_name ?? "—"} />
                <Info label="Branch" value={b.bank_branch ?? "—"} />
                <Info label="Account holder" value={b.bank_account_holder ?? "—"} />
                <Info label="Account number" value={b.bank_account_number ?? "—"} />
                <Info label="IFSC" value={b.bank_ifsc ?? "—"} />
                <Info
                  label="Home loan"
                  value={b.loan_sanctioned
                    ? `Sanctioned${b.loan_amount ? " · " + formatINR(b.loan_amount) : ""}`
                    : "Not sanctioned"}
                />
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Documents</h3>
            {/* PostgREST types an embedded to-one relation as an array, so
                flatten `uploader` to the single row it actually is. */}
            <AttachmentList
              attachments={(attachments ?? []).map((a: any) => ({
                ...a,
                uploader: Array.isArray(a.uploader) ? a.uploader[0] ?? null : a.uploader ?? null
              }))}
            />
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Financial</h3>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Total value"    value={formatINR(b.total_property_value)} />
              <Stat label="Total paid"     value={formatINR(b.total_amount_paid)} tone="emerald" />
              <Stat label="Remaining"      value={formatINR(b.remaining_balance)}   tone="amber" />
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Payment history</h3>
              <span className="text-xs text-slate-500">{payments?.length ?? 0} entries</span>
            </div>
            {(payments?.length ?? 0) === 0 ? (
              <div className="p-6 text-sm text-slate-500">No payments recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium">Payment</th>
                      <th className="px-5 py-3 font-medium text-right">Amount</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Mode</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Submitted by</th>
                      <th className="px-5 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {payments!.map((p: any, i: number) => {
                      const needsReview = ["PENDING", "UNDER_REVIEW"].includes(p.status);
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-5 py-3">
                            <Link href={`/payments/${p.id}`} className="font-medium text-slate-900 hover:text-accent">
                              #{payments!.length - i}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums font-medium">{formatINR(p.amount)}</td>
                          <td className="px-5 py-3">{formatDate(p.payment_date)}</td>
                          <td className="px-5 py-3">{p.payment_mode.replaceAll("_"," ")}</td>
                          <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                          <td className="px-5 py-3 text-slate-500">{displayUser(dir, p.submitted_by)}</td>
                          <td className="px-5 py-3">
                            {/* Each payment is verified on its own — booking approval
                                no longer silently decides later payments. */}
                            {needsReview && canReviewPayments ? (
                              <PaymentReviewActions
                                paymentId={p.id}
                                amount={Number(p.amount)}
                                bookingRef={b.booking_id}
                                size="compact"
                              />
                            ) : (
                              <Link href={`/payments/${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-accent">
                                Details <ArrowRight className="h-3 w-3" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">History</h3>
            {(history?.length ?? 0) === 0 ? (
              <div className="text-sm text-slate-500">No activity yet.</div>
            ) : (
              <ol className="space-y-3">
                {history!.map((h: any) => (
                  <li key={h.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
                    <div className="text-sm">
                      <div className="text-slate-900"><span className="font-medium">{h.actor_user_id ? displayUser(dir, h.actor_user_id) : "System"}</span> · {h.action.replaceAll("_"," ").toLowerCase()}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(h.created_at)}{h.reason ? ` · ${h.reason}` : ""}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900">Submission</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Info label="Submitted by" value={displayUser(dir, b.created_by, { withRole: true })} />
              <Info label="Submitted at" value={formatDateTime(b.submitted_at)} />
              <Info label="Last updated" value={formatDateTime(b.updated_at)} />
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
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Add payment</h3>
              <AddPaymentForm bookingId={b.id} maxAmount={b.remaining_balance} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Info({ label, value, span }: { label: string; value: React.ReactNode; span?: boolean }) {
  return (
    // min-w-0 + break-words: without these a long unbroken property_details
    // string forces the grid column wide and blows out the card.
    <div className={`min-w-0 ${span ? "col-span-2" : ""}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 break-words text-slate-900">{value}</div>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const c = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
