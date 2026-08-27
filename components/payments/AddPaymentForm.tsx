"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/utils/format";
import FileUpload, { type UploadedFile } from "@/components/ui/FileUpload";

const PAYMENT_MODES = ["BANK_TRANSFER","UPI","CHEQUE","CASH","CARD","OTHER"];

export default function AddPaymentForm({ bookingId, maxAmount }: { bookingId: string; maxAmount: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("BANK_TRANSFER");
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Guard against double-submission (StrictMode double-invoke, double-click, etc.)
  const submittingRef = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Hard guard — reject if already in-flight
    if (submittingRef.current) return;

    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    if (amt > Number(maxAmount)) return setError(`Amount exceeds remaining balance (${formatINR(maxAmount)}).`);

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
        return;
      }

      // Success — reset form
      setAmount("");
      setRef("");
      setFile(null);
      setSuccess(true);
      // Delay refresh slightly so the success state renders
      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 1200);
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Amount (max {formatINR(maxAmount)})</label>
        <input className="input" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label className="label">Mode</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)} disabled={busy}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replaceAll("_"," ")}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Reference no.</label>
        <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Txn / UTR / cheque no." disabled={busy} />
      </div>

      <FileUpload
        label="Payment receipt / UTR slip"
        helper="Upload bank receipt, screenshot or cheque copy (PDF, PNG, JPG)"
        onFileSelect={(f) => setFile(f)}
        value={file}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
          <span className="font-medium">⚠ {error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <span className="font-medium">✓ Payment submitted successfully! Refreshing…</span>
        </div>
      )}

      <button
        type="submit"
        className="btn-primary w-full h-10"
        disabled={busy || success}
        aria-busy={busy}
      >
        {busy ? "Submitting payment…" : success ? "Payment submitted!" : "Submit payment"}
      </button>
    </form>
  );
}

