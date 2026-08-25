"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

const ROLES = ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"];

export default function ApprovalRow({ userId, defaultRole }: { userId: string; defaultRole: string }) {
  const router = useRouter();
  const [role, setRole] = useState(defaultRole);
  const [busy, setBusy] = useState(false);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(true);
    await fetch(`/api/users/${userId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, role })
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select className="input h-10 w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button onClick={() => decide("APPROVED")} disabled={busy} className="btn-success h-10">
        <Check className="h-4 w-4" /> Approve
      </button>
      <button onClick={() => decide("REJECTED")} disabled={busy} className="btn-danger h-10">
        <X className="h-4 w-4" /> Reject
      </button>
    </div>
  );
}
