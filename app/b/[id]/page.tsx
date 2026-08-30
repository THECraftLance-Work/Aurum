import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdmin();

  const { data: b } = await admin
    .from("bookings")
    .select("*, customer:customer_id(*), creator:created_by(name, role, email)")
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();

  // Customer has no account — use service-role for related reads
  const [{ data: payments }, { data: history }, { data: attachments }] = await Promise.all([
    admin.from("payments").select("*, submitter:submitted_by(name, role), reviewer:reviewed_by(name, role)").eq("booking_id", b.id).order("created_at", { ascending: false }).limit(100),
    admin.from("audit_logs").select("*, actor:actor_user_id(name)").eq("entity_type", "booking").eq("entity_id", b.id).order("created_at", { ascending: false }).limit(50),
    admin.from("attachments").select("id, file_name, file_size, mime_type, storage_path, label, created_at, uploader:uploaded_by(name)").eq("entity_type", "booking").eq("entity_id", b.id).order("created_at", { ascending: false }),
  ]);

  const flat = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const customer = flat(b.customer);
  const creator = flat(b.creator);

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ec3013] text-sm font-extrabold text-white">A</span>
            <span className="text-sm font-bold tracking-tight text-slate-900">Aurum</span>
            <span className="hidden text-xs text-slate-400 sm:inline">Real Estate</span>
          </Link>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">No login required · Unique ID {id.slice(0, 8)}</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{b.booking_id}</h1>
            <p className="mt-1 text-sm text-slate-500">{b.project_name} · Unit {b.unit_number}</p>
          </div>
          <StatusBadge status={b.status} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="card p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Customer</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="Name" value={customer?.name ?? "—"} />
                <Info label="Phone" value={customer?.phone ?? "—"} />
                <Info label="Email" value={customer?.email ?? "—"} />
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Property</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="Project" value={b.project_name} />
                <Info label="Unit" value={b.unit_number} />
                <Info label="Details" value={b.property_details ?? "—"} span />
                {b.notes && <Info label="Notes" value={b.notes} span />}
              </div>
            </div>

            {(b.bank_name || b.bank_account_number || b.loan_sanctioned) && (
              <div className="card p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">Bank details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Info label="Bank" value={b.bank_name ?? "—"} />
                  <Info label="Branch" value={b.bank_branch ?? "—"} />
                  <Info label="Account holder" value={b.bank_account_holder ?? "—"} />
                  <Info label="Account number" value={maskAccount(b.bank_account_number)} />
                  <Info label="IFSC" value={b.bank_ifsc ?? "—"} />
                  <Info label="Home loan" value={b.loan_sanctioned ? `Sanctioned${b.loan_amount ? " · " + formatINR(b.loan_amount) : ""}` : "Not sanctioned"} />
                </div>
              </div>
            )}

            <div className="card p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Financial</h3>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Total value" value={formatINR(b.total_property_value)} />
                <Stat label="Total paid" value={formatINR(b.total_amount_paid)} tone="emerald" />
                <Stat label="Remaining" value={formatINR(b.remaining_balance)} tone="amber" />
              </div>
            </div>

            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Payment history</h3>
                <span className="text-xs text-slate-500">{payments?.length ?? 0} entries</span>
              </div>
              {(payments?.length ?? 0) === 0 ? (
                <div className="p-6 text-sm text-slate-500">No payments recorded.</div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500"><tr>
                        <th className="px-5 py-3 font-medium">#</th><th className="px-5 py-3 text-right font-medium">Amount</th><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Mode</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">By</th>
                      </tr></thead>
                      <tbody>
                        {payments!.map((p: any, i: number) => (
                          <tr key={p.id} className="border-t border-slate-200">
                            <td className="px-5 py-3">#{payments!.length - i}</td>
                            <td className="px-5 py-3 text-right tabular-nums font-medium">{formatINR(p.amount)}</td>
                            <td className="px-5 py-3">{formatDate(p.payment_date)}</td>
                            <td className="px-5 py-3">{String(p.payment_mode).replaceAll("_", " ")}</td>
                            <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                            <td className="px-5 py-3 text-slate-500">{flat(p.submitter)?.name ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="divide-y divide-slate-200 sm:hidden">
                    {payments!.map((p: any, i: number) => (
                      <li key={p.id} className="p-4">
                        <div className="flex items-start justify-between gap-2"><span className="font-medium">#{payments!.length - i}</span><StatusBadge status={p.status} /></div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm"><div><div className="text-xs text-slate-500">Amount</div><div className="font-semibold tabular-nums">{formatINR(p.amount)}</div></div><div><div className="text-xs text-slate-500">Date</div><div>{formatDate(p.payment_date)}</div></div></div>
                        <div className="mt-1 text-xs text-slate-500">{String(p.payment_mode).replaceAll("_", " ")} · {flat(p.submitter)?.name ?? "—"}</div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {(attachments?.length ?? 0) > 0 && (
              <div className="card p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">Documents ({attachments!.length})</h3>
                <ul className="space-y-2">
                  {(attachments ?? []).map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate"><span className="font-medium">{a.file_name}</span><span className="ml-2 text-xs text-slate-500">{a.label ?? ""}</span></span>
                      <span className="shrink-0 text-xs text-slate-400">{(a.file_size / 1024).toFixed(0)} KB</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(history?.length ?? 0) > 0 && (
              <div className="card p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">History</h3>
                <ol className="space-y-3">
                  {history!.map((h: any) => (
                    <li key={h.id} className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" /><span className="text-sm"><span className="font-medium">{flat(h.actor)?.name ?? "System"}</span> · {String(h.action).replaceAll("_", " ").toLowerCase()}<span className="block text-xs text-slate-500">{formatDateTime(h.created_at)}</span></span></li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900">Submission</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <Info label="Submitted by" value={`${creator?.name ?? "—"} (${creator?.role ?? ""})`} />
                <Info label="Submitted at" value={formatDateTime(b.submitted_at)} />
                <Info label="Status" value={b.status} />
                <Info label="Last updated" value={formatDateTime(b.updated_at)} />
                {b.rejection_reason && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700"><div className="font-medium">Rejection reason</div><div>{b.rejection_reason}</div></div>}
              </dl>
              <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">You are viewing this page via a secure link with your unique booking ID. No login required. Share this link only with people you trust.</p>
            </div>
          </aside>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">Aurum Real Estate · Booking {b.booking_id} · Unique ID {b.id}</footer>
    </div>
  );
}

function Info({ label, value, span }: { label: string; value: React.ReactNode; span?: boolean }) {
  return <div className={`min-w-0 ${span ? "col-span-2" : ""}`}><div className="text-xs text-slate-500">{label}</div><div className="mt-0.5 break-words font-medium text-slate-900">{value}</div></div>;
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const c = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  return <div className="rounded-xl border border-slate-200 p-4"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{value}</div></div>;
}

/**
 * Mask all but the last four digits.
 *
 * This page is reachable by anyone holding the URL — it is the link we email to
 * customers, who have no account to log into. Showing a full bank account
 * number to whoever the link is forwarded to is needless exposure; the last
 * four are enough for the customer to recognise their own account.
 */
function maskAccount(v: string | null | undefined) {
  if (!v) return "—";
  const digits = v.replace(/\s+/g, "");
  if (digits.length <= 4) return digits;
  return "•".repeat(Math.max(4, digits.length - 4)) + digits.slice(-4);
}
