import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import PageHeader from "@/components/ui/PageHeader";
import PaymentReviewActions from "@/components/payments/PaymentReviewActions";
import AttachmentList from "@/components/bookings/AttachmentList";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { resolveDirectory, displayUser } from "@/lib/utils/directory";
import {
  CheckCircle2, XCircle, Clock, ArrowLeft, Landmark, Receipt, Hash, User, Copy
} from "lucide-react";
import CopyButton from "@/components/ui/CopyButton";

export const dynamic = "force-dynamic";

const MODE_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Bank Transfer / NEFT",
  UPI: "UPI",
  CHEQUE: "Cheque",
  CASH: "Cash",
  CARD: "Card",
  OTHER: "Other"
};

export default async function PaymentDetail({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();

  const { data: p } = await supabase
    .from("payments")
    .select(`
      *,
      booking:booking_id(id, booking_id, project_name, unit_number, total_property_value, total_amount_paid, remaining_balance, customer:customer_id(name, phone, email)),
      submitted_by,
      reviewed_by
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (!p) notFound();

  const booking: any = Array.isArray(p.booking) ? p.booking[0] : p.booking;
  const dir = await resolveDirectory([p.submitted_by, p.reviewed_by]);
  const submitter = p.submitted_by ? dir.get(p.submitted_by) ?? null : null;
  const reviewer = p.reviewed_by ? dir.get(p.reviewed_by) ?? null : null;
  const customer: any = booking?.customer
    ? (Array.isArray(booking.customer) ? booking.customer[0] : booking.customer)
    : null;

  // Receipts are linked to the payment; read with the admin client because the
  // page already authorised the viewer above.
  const admin = createSupabaseAdmin();
  const { data: docs } = await admin
    .from("attachments")
    .select("id, file_name, file_size, mime_type, storage_path, label, created_at, uploader:uploaded_by(name)")
    .eq("entity_type", "payment")
    .eq("entity_id", p.id)
    .order("created_at", { ascending: false });

  const canReview =
    ["ACCOUNTANT", "ADMIN", "DIRECTOR"].includes(user.role) &&
    ["PENDING", "UNDER_REVIEW"].includes(p.status);

  const isApproved = p.status === "APPROVED";
  const isRejected = p.status === "REJECTED";

  // Paytm/PhonePe-style: one dominant status colour drives the whole header.
  const tone = isApproved
    ? { bg: "bg-emerald-50", ring: "border-emerald-200", fg: "text-emerald-700", Icon: CheckCircle2, label: "Payment approved" }
    : isRejected
      ? { bg: "bg-rose-50", ring: "border-rose-200", fg: "text-rose-700", Icon: XCircle, label: "Payment rejected" }
      : { bg: "bg-amber-50", ring: "border-amber-200", fg: "text-amber-700", Icon: Clock, label: "Awaiting verification" };

  const timeline = [
    {
      label: "Payment submitted",
      at: p.created_at,
      by: submitter?.name,
      done: true
    },
    {
      label: isRejected ? "Rejected by accountant" : isApproved ? "Verified by accountant" : "Awaiting accountant verification",
      at: p.reviewed_at,
      by: reviewer?.name,
      done: isApproved || isRejected,
      failed: isRejected
    },
    {
      label: isRejected ? "Not credited to booking" : "Credited to booking balance",
      at: isApproved ? p.reviewed_at : null,
      by: null,
      done: isApproved,
      failed: isRejected
    }
  ];

  return (
    <>
      <PageHeader
        title="Payment details"
        description={booking ? `${booking.booking_id} · ${booking.project_name}` : undefined}
        actions={
          <Link href="/payments" className="btn-secondary h-10">
            <ArrowLeft className="h-4 w-4" /> All payments
          </Link>
        }
      />

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Status header — the amount is the hero, as in a payments app */}
          <div className={cn("card border", tone.bg, tone.ring)}>
            <div className="flex flex-col items-center py-4 text-center">
              <div className={cn("grid h-12 w-12 place-items-center rounded-full bg-white", tone.fg)}>
                <tone.Icon className="h-6 w-6" />
              </div>
              <div className={cn("mt-3 text-sm font-semibold", tone.fg)}>{tone.label}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
                {formatINR(p.amount)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {MODE_LABEL[p.payment_mode] ?? p.payment_mode} · {formatDate(p.payment_date)}
              </div>
            </div>

            {isRejected && p.rejection_reason && (
              <div className="mt-2 rounded-xl border border-rose-200 bg-white px-3.5 py-3">
                <div className="text-xs font-semibold text-rose-800">Reason for rejection</div>
                <div className="mt-0.5 break-words text-sm text-rose-900">{p.rejection_reason}</div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Status timeline</h3>
            <ol className="space-y-0">
              {timeline.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 bg-white",
                      step.failed ? "border-rose-500 text-rose-600"
                        : step.done ? "border-emerald-500 text-emerald-600"
                          : "border-slate-300 text-slate-300"
                    )}>
                      {step.failed ? <XCircle className="h-3 w-3" />
                        : step.done ? <Check3 /> : <Clock className="h-3 w-3" />}
                    </span>
                    {i < timeline.length - 1 && (
                      <span className={cn("w-0.5 flex-1 min-h-[28px]", step.done && !step.failed ? "bg-emerald-500" : "bg-slate-200")} />
                    )}
                  </div>
                  <div className="pb-6">
                    <div className={cn("text-sm font-medium", step.done ? "text-slate-900" : "text-slate-400")}>
                      {step.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {step.at ? formatDateTime(step.at) : "Pending"}
                      {step.by ? ` · ${step.by}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Transaction details */}
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Transaction details</h3>
            <dl className="divide-y divide-border text-sm">
              <Row icon={Hash} label="Transaction ID" value={p.id} mono copyable />
              <Row icon={Receipt} label="Reference / UTR" value={p.reference_no || "—"} mono copyable={Boolean(p.reference_no)} />
              <Row icon={Landmark} label="Payment mode" value={MODE_LABEL[p.payment_mode] ?? p.payment_mode} />
              <Row icon={Clock} label="Payment date" value={formatDate(p.payment_date)} />
              <Row icon={User} label="Recorded by" value={submitter ? `${submitter.name} (${submitter.role})` : "—"} />
              {reviewer && <Row icon={User} label="Verified by" value={`${reviewer.name} (${reviewer.role})`} />}
              {p.notes && <Row icon={Receipt} label="Notes" value={p.notes} />}
            </dl>
          </div>

          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Receipt</h3>
            <AttachmentList
              attachments={(docs ?? []).map((a: any) => ({
                ...a,
                uploader: Array.isArray(a.uploader) ? a.uploader[0] ?? null : a.uploader ?? null
              }))}
            />
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          {canReview && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-900">Verify this payment</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Approving credits {formatINR(p.amount)} to the booking balance. Rejecting requires a reason.
              </p>
              <div className="mt-3">
                <PaymentReviewActions
                  paymentId={p.id}
                  amount={Number(p.amount)}
                  bookingRef={booking?.booking_id ?? ""}
                />
              </div>
            </div>
          )}

          {booking && (
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Booking</h3>
              <Link
                href={`/bookings/${booking.id}`}
                className="block rounded-xl border border-border px-3.5 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-900">{booking.booking_id}</div>
                <div className="truncate text-xs text-slate-500">
                  {booking.project_name} · Unit {booking.unit_number}
                </div>
              </Link>

              <dl className="mt-3 space-y-2 text-sm">
                <Money label="Property value" value={booking.total_property_value} />
                <Money label="Total paid (verified)" value={booking.total_amount_paid} tone="emerald" />
                <Money label="Remaining" value={booking.remaining_balance} tone="amber" />
              </dl>

              {!isApproved && !isRejected && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                  This payment is not yet counted in the totals above. It is credited only once an accountant approves it.
                </p>
              )}
            </div>
          )}

          {customer && (
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Customer</h3>
              <dl className="space-y-2 text-sm">
                <Info label="Name" value={customer.name} />
                <Info label="Phone" value={customer.phone ?? "—"} />
                <Info label="Email" value={customer.email ?? "—"} />
              </dl>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Check3() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Row({
  icon: Icon, label, value, mono, copyable
}: { icon: any; label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="flex shrink-0 items-center gap-2 text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </dt>
      <dd className={cn("min-w-0 break-all text-right text-slate-900", mono && "font-mono text-xs")}>
        {copyable ? (
          <span className="inline-flex items-center gap-1.5">
            {value}
            <CopyButton value={value} />
          </span>
        ) : value}
      </dd>
    </div>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  const c = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", c)}>{formatINR(value)}</dd>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-slate-900">{value}</dd>
    </div>
  );
}
