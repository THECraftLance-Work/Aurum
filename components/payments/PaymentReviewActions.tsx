"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatINR } from "@/lib/utils/format";

export default function PaymentReviewActions({
  paymentId,
  amount,
  bookingRef,
  size = "default",
}: {
  paymentId: string;
  amount: number;
  bookingRef: string;
  size?: "default" | "compact";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(decision: "APPROVED" | "REJECTED") {
    if (busy) return;
    if (decision === "REJECTED" && reason.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          reason: decision === "REJECTED" ? reason.trim() : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          tone: "error",
          title: "Could not record decision",
          description: json.error,
        });
        return;
      }
      toast({
        tone: decision === "APPROVED" ? "success" : "warning",
        title:
          decision === "APPROVED" ? "Payment approved" : "Payment rejected",
        description: `${formatINR(amount)} on ${bookingRef}`,
      });
      setMode("idle");
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (mode === "rejecting") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
        <label className="label text-rose-800">
          Why is this being rejected?
        </label>
        <textarea
          className="input min-h-[80px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. UTR does not match the bank statement"
          autoFocus
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              setMode("idle");
              setReason("");
            }}
            disabled={busy}
            className="btn-secondary h-9 flex-1"
          >
            Cancel
          </button>
          <button
            onClick={() => submit("REJECTED")}
            disabled={busy || reason.trim().length < 3}
            className="btn-danger h-9 flex-1"
          >
            {busy ? "Rejecting…" : "Confirm reject"}
          </button>
        </div>
      </div>
    );
  }

  const h = size === "compact" ? "h-8 px-2.5 text-xs" : "h-10";

  return (
    <div className="flex gap-2">
      <button
        onClick={() => submit("APPROVED")}
        disabled={busy}
        className={`btn-success flex-1 ${h}`}
      >
        <Check className="h-3.5 w-3.5" /> Approve
      </button>
      <button
        onClick={() => setMode("rejecting")}
        disabled={busy}
        className={`btn-danger flex-1 ${h}`}
      >
        <X className="h-3.5 w-3.5" /> Reject
      </button>
    </div>
  );
}
