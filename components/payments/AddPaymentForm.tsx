"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/utils/format";
import { AlertCircle, CheckCircle2, Clock, ArrowLeft, ShieldCheck } from "lucide-react";
import FileUpload, { type UploadedFile } from "@/components/ui/FileUpload";

const PAYMENT_MODES = ["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD", "OTHER"];

export default function AddPaymentForm({
  bookingId,
  maxAmount,
  totalPaid = 0
}: {
  bookingId: string;
  maxAmount: number;
  /** Verified total so far — used to preview the balance after this payment. */
  totalPaid?: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("BANK_TRANSFER");
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Two-step: enter details, then review before submitting.
   *
   * A payment goes straight into the accountant's queue and cannot be edited
   * afterwards — only approved or rejected. A mistyped amount or UTR therefore
   * costs a rejection cycle, so the numbers get one explicit confirmation.
   */
  const [step, setStep] = useState<"entry" | "review">("entry");

  const submittingRef = useRef(false);
  const amt = Number(amount);
  const valid = Boolean(amt) && amt > 0 && amt <= Number(maxAmount);

  const newTotalPaid = Number(totalPaid) + (amt || 0);
  const newRemaining = Math.max(0, Number(maxAmount) - (amt || 0));

  function toReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    if (amt > Number(maxAmount)) {
      return setError(`Amount exceeds the remaining balance of ${formatINR(maxAmount)}.`);
    }
    setStep("review");
  }

  async function confirmSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          amount: amt,
          payment_date: date,
          payment_mode: mode,
          reference_no: ref || null,
          attachment: file
            ? { storagePath: file.storagePath, name: file.name, size: file.size, type: file.type }
            : null
        })
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to add payment.");
        setStep("entry");
        return;
      }

      setAmount("");
      setRef("");
      setFile(null);
      setStep("entry");
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 1400);
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  // ---------------------------------------------------------------- review
  if (step === "review") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <ShieldCheck className="h-4 w-4" /> Check before submitting
          </div>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            This goes to the accounts team for verification and cannot be edited
            afterwards — only approved or rejected.
          </p>
        </div>

        <dl className="rounded-xl border border-border divide-y divide-border text-sm">
          <Row label="Amount" value={formatINR(amt)} strong />
          <Row label="Date" value={new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" })} />
          <Row label="Mode" value={mode.replaceAll("_", " ")} />
          <Row label="Reference / UTR" value={ref || "Not provided"} muted={!ref} />
          <Row label="Receipt" value={file ? file.name : "None attached"} muted={!file} />
        </dl>

        <div className="rounded-xl border border-border bg-slate-50 p-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            After verification
          </div>
          <dl className="space-y-1.5 text-sm">
            <Line label="Verified so far" value={formatINR(totalPaid)} />
            <Line label="This payment" value={`+ ${formatINR(amt)}`} tone="emerald" />
            <div className="my-1 h-px bg-slate-200" />
            <Line label="Total paid" value={formatINR(newTotalPaid)} strong />
            <Line label="Balance remaining" value={formatINR(newRemaining)} tone="amber" strong />
          </dl>
          <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
            <Clock className="mt-0.5 h-3 w-3 shrink-0" />
            These figures apply once an accountant approves it. Until then the
            booking balance is unchanged.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep("entry")}
            disabled={busy}
            className="btn-secondary h-10 flex-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={confirmSubmit}
            disabled={busy}
            className="btn-primary h-10 flex-1"
          >
            {busy ? "Submitting…" : "Confirm & submit"}
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- entry
  return (
    <form onSubmit={toReview} className="space-y-3">
      <div>
        <label className="label">Amount (max {formatINR(maxAmount)})</label>
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
        />
        {amt > 0 && amt <= Number(maxAmount) && (
          <p className="mt-1 text-[11px] text-slate-500">
            Leaves {formatINR(newRemaining)} outstanding once verified.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label className="label">Mode</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)} disabled={busy}>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{m.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Reference no.</label>
        <input
          className="input"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Txn / UTR / cheque no."
          disabled={busy}
        />
      </div>

      <FileUpload
        label="Payment receipt / UTR slip"
        helper="Upload bank receipt, screenshot or cheque copy (PDF, PNG, JPG)"
        onFileSelect={(f) => setFile(f)}
        value={file}
        disabled={busy}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Payment submitted for verification.</span>
        </div>
      )}

      <button type="submit" className="btn-primary h-10 w-full" disabled={busy || !valid}>
        Review payment
      </button>
    </form>
  );
}

function Row({
  label, value, strong, muted
}: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right ${strong ? "font-semibold tabular-nums" : ""} ${muted ? "text-slate-400" : "text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}

function Line({
  label, value, tone, strong
}: { label: string; value: string; tone?: "emerald" | "amber"; strong?: boolean }) {
  const c = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""} ${c}`}>{value}</dd>
    </div>
  );
}
