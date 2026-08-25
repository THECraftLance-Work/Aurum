"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Replaces window.confirm() for destructive actions, so confirmation matches
 * the rest of the UI and can carry real context (names, counts, consequences).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 animate-fade-in" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-pop animate-scale-in">
        <div className="flex items-start gap-3">
          <div className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
          )}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">{message}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="btn-secondary h-9">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={cn("h-9", tone === "danger" ? "btn-danger" : "btn-primary")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
