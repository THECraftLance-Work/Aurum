"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";

export default function TicketThread({
  ticketId, comments, currentUserId, isStaff
}: {
  ticketId: string;
  comments: any[];
  currentUserId: string;
  isStaff: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim(), is_internal: internal })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ tone: "error", title: "Could not post reply", description: json.error });
        return;
      }
      setBody(""); setInternal(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card min-w-0">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        Conversation <span className="font-normal text-slate-400">({comments.length})</span>
      </h3>

      {comments.length === 0 ? (
        <p className="text-sm text-slate-500">No replies yet.</p>
      ) : (
        <ol className="space-y-3">
          {comments.map((c) => {
            const mine = c.author_id === currentUserId;
            return (
              <li
                key={c.id}
                className={cn(
                  "rounded-2xl border px-3.5 py-3 animate-fade-in-up",
                  c.is_internal
                    ? "border-amber-200 bg-amber-50"
                    : mine
                      ? "border-border bg-slate-50"
                      : "border-border bg-white"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{c.author?.name ?? "Unknown"}</span>
                  <span className="badge bg-slate-100 text-[10px] text-slate-600">{c.author?.role}</span>
                  {c.is_internal && (
                    <span className="badge bg-amber-100 text-[10px] text-amber-800">
                      <Lock className="h-2.5 w-2.5" /> Internal
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-slate-400">{formatDateTime(c.created_at)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{c.body}</p>
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={submit} className="mt-4 border-t border-border pt-4">
        <textarea
          className="input min-h-[90px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a reply…"
          maxLength={4000}
          disabled={busy}
        />
        <div className="mt-2.5 flex items-center justify-between gap-3">
          {isStaff ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="rounded border-slate-300"
                disabled={busy}
              />
              Internal note (hidden from the person who raised this)
            </label>
          ) : <span />}
          <button className="btn-primary h-9" disabled={!body.trim() || busy}>
            <Send className="h-3.5 w-3.5" />
            {busy ? "Sending…" : "Reply"}
          </button>
        </div>
      </form>
    </div>
  );
}
