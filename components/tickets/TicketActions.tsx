"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function TicketActions({
  ticketId, status, priority, assignedTo, staff
}: {
  ticketId: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  staff: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [s, setS] = useState(status);
  const [p, setP] = useState(priority);
  const [a, setA] = useState(assignedTo ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const needsNote = s === "RESOLVED" && status !== "RESOLVED";
  const dirty = s !== status || p !== priority || a !== (assignedTo ?? "");

  async function save() {
    if (busy) return;
    if (needsNote && !note.trim()) {
      toast({ tone: "warning", title: "Resolution note required", description: "Say what was done before resolving." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: s,
          priority: p,
          assigned_to: a || null,
          ...(note.trim() ? { resolution_note: note.trim() } : {})
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ tone: "error", title: "Update failed", description: json.error });
        return;
      }
      toast({ tone: "success", title: "Ticket updated" });
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Manage</h3>
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="tk-status">Status</label>
          <select id="tk-status" className="input" value={s} onChange={(e) => setS(e.target.value)} disabled={busy}>
            {STATUSES.map((x) => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tk-pri">Priority</label>
          <select id="tk-pri" className="input" value={p} onChange={(e) => setP(e.target.value)} disabled={busy}>
            {PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tk-assign">Assign to</label>
          <select id="tk-assign" className="input" value={a} onChange={(e) => setA(e.target.value)} disabled={busy}>
            <option value="">Unassigned</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>

        {needsNote && (
          <div className="animate-fade-in-up">
            <label className="label" htmlFor="tk-note">Resolution note *</label>
            <textarea
              id="tk-note"
              className="input min-h-[80px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was done to resolve this?"
              disabled={busy}
            />
          </div>
        )}

        <button
          onClick={save}
          disabled={busy || (!dirty && !note.trim())}
          className="btn-primary h-10 w-full"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
