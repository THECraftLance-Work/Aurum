"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { roleLabels } from "@/lib/utils/format";

const ROLES = ["SM", "CP", "ACCOUNTANT", "ADMIN", "DIRECTOR"];

export default function UserActionRow({
  userId,
  userEmail,
  currentStatus,
  currentRole,
  isSelf,
  isDirector
}: {
  userId: string;
  userEmail: string;
  currentStatus: string;
  currentRole: string;
  isSelf: boolean;
  isDirector: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [confirmAccess, setConfirmAccess] = useState<null | "APPROVED" | "REJECTED">(null);

  if (isSelf || !isDirector) {
    return <span className="text-xs font-medium text-slate-400">—</span>;
  }

  async function applyRole(role: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ tone: "error", title: "Role not changed", description: json.error ?? "Please try again." });
        return;
      }
      toast({
        tone: "success",
        title: "Role updated",
        description: `${userEmail} is now ${roleLabels[role] ?? role}.`
      });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Network error", description: "Check your connection and try again." });
    } finally {
      setBusy(false);
      setPendingRole(null);
    }
  }

  async function applyAccess(decision: "APPROVED" | "REJECTED") {
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, role: currentRole })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ tone: "error", title: "Update failed", description: json.error ?? "Please try again." });
        return;
      }
      toast({
        tone: decision === "APPROVED" ? "success" : "warning",
        title: decision === "APPROVED" ? "Access restored" : "Access revoked",
        description: userEmail
      });
      router.refresh();
    } finally {
      setBusy(false);
      setConfirmAccess(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <select
          className="input h-8 w-auto py-1 text-xs"
          value={currentRole}
          disabled={busy}
          onChange={(e) => setPendingRole(e.target.value)}
          aria-label={`Change role for ${userEmail}`}
          title="Change role"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabels[r] ?? r}</option>
          ))}
        </select>

        {currentStatus === "APPROVED" ? (
          <button
            type="button"
            onClick={() => setConfirmAccess("REJECTED")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
            title="Revoke access immediately"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Revoke
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmAccess("APPROVED")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            title="Grant / restore access"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Restore
          </button>
        )}
      </div>

      <ConfirmDialog
        open={pendingRole !== null}
        busy={busy}
        tone="primary"
        title="Change this user's role?"
        message={
          <>
            <span className="font-medium">{userEmail}</span> will change from{" "}
            <span className="font-medium">{roleLabels[currentRole] ?? currentRole}</span> to{" "}
            <span className="font-medium">{roleLabels[pendingRole ?? ""] ?? pendingRole}</span>.
            Their menus and data access update immediately.
          </>
        }
        confirmLabel="Change role"
        onConfirm={() => pendingRole && applyRole(pendingRole)}
        onCancel={() => setPendingRole(null)}
      />

      <ConfirmDialog
        open={confirmAccess !== null}
        busy={busy}
        tone={confirmAccess === "REJECTED" ? "danger" : "primary"}
        title={confirmAccess === "REJECTED" ? "Revoke platform access?" : "Restore platform access?"}
        message={
          confirmAccess === "REJECTED"
            ? <>
                <span className="font-medium">{userEmail}</span> will be signed out of the platform and
                blocked from every internal page. Their bookings and payment history are kept.
              </>
            : <>Restore access for <span className="font-medium">{userEmail}</span> as {roleLabels[currentRole] ?? currentRole}.</>
        }
        confirmLabel={confirmAccess === "REJECTED" ? "Revoke access" : "Restore access"}
        onConfirm={() => confirmAccess && applyAccess(confirmAccess)}
        onCancel={() => setConfirmAccess(null)}
      />
    </>
  );
}
