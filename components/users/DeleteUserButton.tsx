"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = confirm.trim() === userName.trim();

  async function doDelete() {
    if (!canDelete || busy) return;
    setBusy(true);
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast({ tone: "error", title: "Could not delete user", description: body.error ?? "Failed." });
      return;
    }
    toast({ tone: "success", title: "User deleted", description: `${userName} has been removed.` });
    setOpen(false);
    setConfirm("");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Delete ${userName}`}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/10" onClick={() => !busy && setOpen(false)} aria-label="Close" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 text-left">Delete {userName}?</h3>
            <p className="mt-1 text-sm text-slate-600 text-left">This will permanently delete the account and revoke all access. This cannot be undone.</p>
            <p className="mt-4 text-xs font-medium text-slate-700 text-left">Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{userName}</span> to confirm:</p>
            <input
              autoFocus
              dir="ltr"
              className="input mt-2 text-left"
              placeholder={userName}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary h-10" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="btn-danger h-10 min-w-[110px]" onClick={doDelete} disabled={!canDelete || busy}>{busy ? "Deleting…" : "Delete account"}</button>
            </div>
            {!canDelete && confirm.length > 0 && <p className="mt-2 text-xs text-rose-600">Name does not match.</p>}
          </div>
        </div>
      )}
    </>
  );
}
