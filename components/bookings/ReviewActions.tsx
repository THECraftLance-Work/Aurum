"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function ReviewActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  async function submit(decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && reason.trim().length < 3) return;
    setBusy(true);
    await fetch(`/api/bookings/${bookingId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, reason: decision === "REJECTED" ? reason.trim() : null })
    });
    setBusy(false);
    setConfirmApprove(false);
    router.refresh();
  }

  if (mode === "rejecting") {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900">Reject booking</h3>
        <label className="label mt-3">Rejection reason *</label>
        <textarea
          className="input min-h-[100px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain what is incorrect or missing."
        />
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setMode("idle"); setReason(""); }} className="btn-secondary flex-1" disabled={busy}>Cancel</button>
          <button onClick={() => submit("REJECTED")} className="btn-danger flex-1" disabled={busy || reason.trim().length < 3}>
            {busy ? "Rejecting…" : "Confirm reject"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900">Verification</h3>
        <p className="mt-1 text-sm text-slate-500">Review the submission and record a decision. Rejection requires a reason.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmApprove(true)} className="btn-success flex-1" disabled={busy}>
            <Check className="h-4 w-4" /> Approve
          </button>
          <button onClick={() => setMode("rejecting")} className="btn-danger flex-1" disabled={busy}>
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmApprove}
        busy={busy}
        tone="primary"
        title="Approve this booking?"
        message="Please confirm that you checked the customer, property, and payment details. Approval finalizes this submission and notifies the person who created it."
        confirmLabel="Yes, approve"
        cancelLabel="Review again"
        onConfirm={() => submit("APPROVED")}
        onCancel={() => setConfirmApprove(false)}
      />
    </>
  );
}
