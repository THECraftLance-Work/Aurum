"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LifeBuoy, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/Toast";

const CATEGORIES = [
  { value: "BUG", label: "Something is broken" },
  { value: "DATA_CORRECTION", label: "Data needs correcting" },
  { value: "BOOKING_ISSUE", label: "Booking issue" },
  { value: "PAYMENT_ISSUE", label: "Payment issue" },
  { value: "ACCESS", label: "Access / permissions" },
  { value: "FEATURE_REQUEST", label: "Feature request" },
  { value: "OTHER", label: "Something else" }
];

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

const UUID_RE = /\/bookings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export default function RaiseTicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [priority, setPriority] = useState("NORMAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (open) { setError(null); }
  }, [open]);

  if (!open) return null;

  const valid = subject.trim().length >= 3 && description.trim().length >= 5;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(null);

    // Auto-capture context: which screen they were on, and the booking if any.
    const bookingMatch = pathname.match(UUID_RE);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
          page_path: pathname,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          related_entity_type: bookingMatch ? "booking" : null,
          related_entity_id: bookingMatch ? bookingMatch[1] : null
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Could not raise the ticket."); return; }

      toast({
        tone: "success",
        title: `Ticket ${json.ticket_number} raised`,
        description: "The admin team has been notified.",
        action: { label: "View ticket", onClick: () => router.push(`/tickets/${json.id}`) }
      });
      setSubject(""); setDescription(""); setCategory("OTHER"); setPriority("NORMAL");
      onClose();
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-stretch justify-end" role="dialog" aria-modal="true" aria-label="Raise a support ticket">
      <div className="absolute inset-0 bg-slate-900/40 animate-fade-in" onClick={() => !busy && onClose()} />
      <form
        onSubmit={submit}
        className="relative h-full w-full max-w-lg overflow-y-auto border-l border-border bg-white shadow-pop animate-slide-in-right"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent-light text-accent">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Raise a support ticket</h2>
              <p className="text-xs text-slate-500">We capture the page you were on automatically.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="label" htmlFor="tkt-subject">Subject</label>
            <input
              id="tkt-subject"
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the problem"
              maxLength={160}
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="tkt-cat">Category</label>
              <select id="tkt-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="tkt-pri">Priority</label>
              <select id="tkt-pri" className="input" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={busy}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="tkt-desc">What happened?</label>
            <textarea
              id="tkt-desc"
              className="input min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you expect, and what happened instead? Include a Booking ID if relevant."
              maxLength={5000}
              disabled={busy}
            />
            <div className="mt-1 text-right text-[11px] text-slate-400">{description.length}/5000</div>
          </div>

          <div className="rounded-xl border border-border bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Attached automatically: <span className="font-mono text-slate-600">{pathname}</span>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary h-10">Cancel</button>
          <button type="submit" disabled={!valid || busy} className={cn("btn-primary h-10")}>
            {busy ? "Submitting…" : "Raise ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
