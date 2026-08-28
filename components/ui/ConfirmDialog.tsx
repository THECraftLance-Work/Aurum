"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Replaces window.confirm() for destructive actions, so confirmation matches
 * the rest of the UI and can carry real context (names, counts, consequences).
 *
 * Rendered through a portal into <body>, which matters for two reasons:
 *
 *  1. `position: fixed` takes an element out of layout flow but NOT out of the
 *     CSS inheritance chain. This dialog is rendered from inside
 *     `<td className="text-right">` on the Users table, so the heading and body
 *     inherited `text-align: right` and hugged the card's right edge.
 *  2. A transformed ancestor makes `position: fixed` resolve against that
 *     element instead of the viewport. `.card-hover:hover` applies a transform,
 *     so a dialog inside a hovered card would be mispositioned.
 *
 * The portal escapes both, permanently, for every call site.
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
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // document doesn't exist during SSR, so the portal can only be created after
  // the first client render.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);

    // Stop the page behind scrolling while the dialog is up.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus Cancel, not Confirm — this dialog is usually destructive, and a
    // stray Enter should not revoke someone's access.
    cancelRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onCancel]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      // text-left is explicit as well as portalled: it documents the intent and
      // survives anyone later rendering this without the portal.
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 text-left"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 animate-fade-in"
        onClick={() => !busy && onCancel()}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-white p-5 text-left shadow-pop animate-scale-in">
        <div className="flex items-start gap-3">
          <div className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
          )}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="text-sm font-semibold text-slate-900">
              {title}
            </h3>
            <div className="mt-1 break-words text-sm leading-relaxed text-slate-600">
              {message}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} onClick={onCancel} disabled={busy} className="btn-secondary h-9">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={cn("h-9", tone === "danger" ? "btn-danger" : "btn-primary")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
