"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/utils/format";
import FileUpload, { type UploadedFile } from "@/components/ui/FileUpload";

const PAYMENT_MODES = ["BANK_TRANSFER","UPI","CHEQUE","CASH","CARD","OTHER"];

export default function NewBookingForm({ role }: { role: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<UploadedFile | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    project_name: "",
    unit_number: "",
    property_details: "",
    total_property_value: "",
    previous_payments: "0",
    current_payment: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_mode: "BANK_TRANSFER",
    reference_no: "",
    notes: "",
    bank_name: "",
    bank_account_holder: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_branch: "",
    loan_sanctioned: "no",
    loan_amount: ""
  });

  function upd<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  const total = Number(form.total_property_value || 0);
  const previous = Number(form.previous_payments || 0);
  const current = Number(form.current_payment || 0);
  const totalPaid = previous + current;
  const remaining = Math.max(0, total - totalPaid);

  // Indian IFSC: 4 letters, a literal 0, then 6 alphanumerics.
  const ifscInvalid = form.bank_ifsc.trim().length > 0
    && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank_ifsc.trim());

  const valid = useMemo(() => {
    return Boolean(form.customer_name && form.project_name && form.unit_number)
      && total > 0 && totalPaid <= total && !ifscInvalid;
  }, [form, total, totalPaid, ifscInvalid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: form.customer_name.trim(),
          phone: form.customer_phone.trim() || null,
          email: form.customer_email.trim() || null
        },
        booking: {
          project_name: form.project_name.trim(),
          unit_number: form.unit_number.trim(),
          property_details: form.property_details.trim() || null,
          total_property_value: total,
          notes: form.notes.trim() || null,
          bank_name: form.bank_name.trim() || null,
          bank_account_holder: form.bank_account_holder.trim() || null,
          bank_account_number: form.bank_account_number.trim() || null,
          bank_ifsc: form.bank_ifsc.trim() || null,
          bank_branch: form.bank_branch.trim() || null,
          loan_sanctioned: form.loan_sanctioned === "yes",
          loan_amount: form.loan_sanctioned === "yes" && form.loan_amount ? Number(form.loan_amount) : null
        },
        attachment: doc
          ? { storagePath: doc.storagePath, name: doc.name, size: doc.size, type: doc.type }
          : null,
        initialPayment: current > 0 ? {
          amount: current,
          payment_date: form.payment_date,
          payment_mode: form.payment_mode,
          reference_no: form.reference_no.trim() || null
        } : null,
        previousPayments: previous
      })
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); return setError(j.error ?? "Failed to create booking."); }
    const { id } = await res.json();
    router.push(`/bookings/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Section title="Customer details">
          <Grid>
            <Field label="Customer name *" v={form.customer_name} onChange={(v) => upd("customer_name", v)} />
            <Field label="Phone" v={form.customer_phone} onChange={(v) => upd("customer_phone", v)} />
            <Field label="Email" v={form.customer_email} onChange={(v) => upd("customer_email", v)} type="email" />
          </Grid>
        </Section>

        <Section title="Booking details">
          <Grid>
            <Field label="Project / property name *" v={form.project_name} onChange={(v) => upd("project_name", v)} />
            <Field label="Unit / flat number *" v={form.unit_number} onChange={(v) => upd("unit_number", v)} />
            <TextArea label="Property details" v={form.property_details} onChange={(v) => upd("property_details", v)} rows={3} full />
          </Grid>
        </Section>

        <Section title="Bank details">
          <Grid>
            <Field label="Bank name" v={form.bank_name} onChange={(v) => upd("bank_name", v)} />
            <Field label="Branch" v={form.bank_branch} onChange={(v) => upd("bank_branch", v)} />
            <Field label="Account holder name" v={form.bank_account_holder} onChange={(v) => upd("bank_account_holder", v)} />
            <Field label="Account number" v={form.bank_account_number} onChange={(v) => upd("bank_account_number", v)} />
            <Field label="IFSC code" v={form.bank_ifsc} onChange={(v) => upd("bank_ifsc", v.toUpperCase())} />
            <Select label="Home loan sanctioned" v={form.loan_sanctioned} onChange={(v) => upd("loan_sanctioned", v)} options={["no", "yes"]} />
            {form.loan_sanctioned === "yes" && (
              <Field label="Loan amount (₹)" v={form.loan_amount} onChange={(v) => upd("loan_amount", v)} type="number" min={0} step={1} />
            )}
          </Grid>
          {ifscInvalid && (
            <p className="mt-2 text-xs text-amber-700">
              IFSC codes are 11 characters: 4 letters, a 0, then 6 alphanumerics (e.g. HDFC0001234).
            </p>
          )}
        </Section>

        <Section title="Financial details & proof">
          <Grid>
            <Field label="Total property value *" v={form.total_property_value} onChange={(v) => upd("total_property_value", v)} type="number" min={0} step={1} />
            <Field label="Previous payments (₹)" v={form.previous_payments} onChange={(v) => upd("previous_payments", v)} type="number" min={0} step={1} />
            <Field label="Current payment (₹)" v={form.current_payment} onChange={(v) => upd("current_payment", v)} type="number" min={0} step={1} />
            <Field label="Payment date" v={form.payment_date} onChange={(v) => upd("payment_date", v)} type="date" />
            <Select label="Payment mode" v={form.payment_mode} onChange={(v) => upd("payment_mode", v)} options={PAYMENT_MODES} />
            <Field label="Reference no." v={form.reference_no} onChange={(v) => upd("reference_no", v)} />
            <TextArea label="Notes" v={form.notes} onChange={(v) => upd("notes", v)} rows={2} full />
            <div className="col-span-2">
              <FileUpload
                label="Booking agreement / payment proof"
                helper="Upload customer ID, booking agreement or payment receipt (PDF, PNG, JPG)"
                onFileSelect={(f) => setDoc(f)}
                value={doc}
              />
            </div>
          </Grid>
        </Section>
      </div>

      <aside className="space-y-4">
        <div className="card p-5 sticky top-24">
          <h3 className="text-sm font-semibold text-slate-900">Live summary</h3>
          <div className="mt-4 space-y-3 text-sm">
            <SummaryRow label="Total property value" value={formatINR(total)} />
            <SummaryRow label="Previous payments" value={formatINR(previous)} />
            <SummaryRow label="Current payment" value={formatINR(current)} accent="emerald" />
            <div className="divider my-2" />
            <SummaryRow label="Total paid" value={formatINR(totalPaid)} bold />
            <SummaryRow label="Remaining balance" value={formatINR(remaining)} accent="amber" bold />
          </div>
          {error && <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}
          {totalPaid > total && total > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              Payments cannot exceed the total value.
            </div>
          )}
          <button disabled={busy || !valid} className="btn-primary w-full mt-5 h-11">
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed">
            A Booking ID is generated when this form is submitted. Accountants will be notified for verification.
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">Submitting as {role}</p>
        </div>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}
function Field(props: { label: string; v: string; onChange: (v: string) => void; type?: string; min?: number; step?: number }) {
  return (
    <div>
      <label className="label">{props.label}</label>
      <input className="input" value={props.v} onChange={(e) => props.onChange(e.target.value)} type={props.type ?? "text"} min={props.min} step={props.step} />
    </div>
  );
}
function TextArea(props: { label: string; v: string; onChange: (v: string) => void; rows?: number; full?: boolean }) {
  return (
    <div className={props.full ? "md:col-span-2" : ""}>
      <label className="label">{props.label}</label>
      <textarea className="input min-h-[88px]" rows={props.rows ?? 3} value={props.v} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}
function Select(props: { label: string; v: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="label">{props.label}</label>
      <select className="input" value={props.v} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((o) => <option key={o} value={o}>{o.replaceAll("_", " ")}</option>)}
      </select>
    </div>
  );
}
function SummaryRow({ label, value, accent, bold }: { label: string; value: string; accent?: "emerald" | "amber"; bold?: boolean }) {
  const color = accent === "emerald" ? "text-emerald-700" : accent === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="flex items-center justify-between">
      <div className="text-slate-500">{label}</div>
      <div className={`${bold ? "font-semibold" : ""} ${color} tabular-nums`}>{value}</div>
    </div>
  );
}
