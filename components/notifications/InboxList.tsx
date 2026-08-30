"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Search, CheckCheck, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Notif = {
  id: string;
  category: string;
  title: string;
  message: string;
  is_read: boolean;
  priority: string;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
};

function entityHref(n: Notif) {
  if (!n.entity_id) return null;
  if (n.entity_type === "booking") return `/bookings/${n.entity_id}`;
  if (n.entity_type === "ticket") return `/tickets/${n.entity_id}`;
  if (n.entity_type === "user") return "/approvals";
  return null;
}

const CATEGORIES = [
  "ALL",
  "UNREAD",
  "ACCESS_REQUEST",
  "APPROVAL",
  "REJECTION",
  "PAYMENT",
  "BOOKING",
  "TICKET",
  "SYSTEM",
  "IMPORTANT",
];

export default function InboxList({
  initial,
  userId,
}: {
  initial: Notif[];
  userId: string;
}) {
  const supabase = createSupabaseBrowser();
  const { toast } = useToast();
  const [items, setItems] = useState<Notif[]>(initial);
  const [filter, setFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<null | "ALL" | "READ">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel(`inbox-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => setItems((prev) => [payload.new as Notif, ...prev]),
      )
      // Keep other tabs / the header drawer in sync when rows are cleared.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) =>
          setItems((prev) =>
            prev.filter((n) => n.id !== (payload.old as any).id),
          ),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, userId]);

  const filtered = items.filter((n) => {
    if (filter === "UNREAD" && n.is_read) return false;
    if (filter !== "ALL" && filter !== "UNREAD" && n.category !== filter)
      return false;
    if (q && !`${n.title} ${n.message}`.toLowerCase().includes(q.toLowerCase()))
      return false;
    return true;
  });

  async function markOne(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", userId)
      .eq("is_read", false);
  }

  /** `.select()` returns deleted rows — empty means RLS blocked the delete
   *  (the DELETE policy ships in migration 0002), which would otherwise look
   *  like success until the next refresh. */
  async function clearOne(n: Notif) {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", n.id)
      .select("id");
    if (error || !data?.length) {
      setItems((prev) =>
        [n, ...prev].sort(
          (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
        ),
      );
      toast({
        tone: "error",
        title: "Could not clear notification",
        description:
          error?.message ??
          "Clearing is not enabled yet — apply migration 0002.",
      });
      return;
    }
    toast({ tone: "info", title: "Notification cleared", duration: 3000 });
  }

  async function bulkClear(mode: "ALL" | "READ") {
    setBusy(true);
    const snapshot = items;
    const doomed = mode === "ALL" ? items : items.filter((n) => n.is_read);
    setItems(mode === "ALL" ? [] : items.filter((n) => !n.is_read));

    let query = supabase
      .from("notifications")
      .delete()
      .eq("recipient_user_id", userId);
    if (mode === "READ") query = query.eq("is_read", true);
    const { data, error } = await query.select("id");

    setBusy(false);
    setConfirm(null);
    if (error || (doomed.length > 0 && !data?.length)) {
      setItems(snapshot);
      toast({
        tone: "error",
        title: "Could not clear notifications",
        description:
          error?.message ??
          "Clearing is not enabled yet — apply migration 0002.",
      });
      return;
    }
    toast({
      tone: "success",
      title: mode === "ALL" ? "Inbox cleared" : "Read notifications cleared",
      description: `${data?.length ?? 0} removed.`,
    });
  }

  const readCount = items.filter((n) => n.is_read).length;

  return (
    <>
      <div className="card min-w-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input h-10 pl-9"
              placeholder="Search messages…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button onClick={markAll} className="btn-secondary h-9 px-3 text-xs">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
          <button
            onClick={() => setConfirm("READ")}
            disabled={readCount === 0}
            className="btn-secondary h-9 px-3 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear read ({readCount})
          </button>
          <button
            onClick={() => setConfirm("ALL")}
            disabled={items.length === 0}
            className="btn-secondary h-9 px-3 text-xs text-rose-600 hover:border-rose-200 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                "badge h-8 border px-3 transition-all duration-150",
                filter === c
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-border bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {c.replaceAll("_", " ")}
            </button>
          ))}
        </div>

        <ul className="h-[calc(95vh-260px)] divide-y divide-border overflow-y-auto overscroll-contain">
          {filtered.map((n) => {
            const href = entityHref(n);
            return (
              <li
                key={n.id}
                className={cn(
                  "group px-5 py-4 transition-colors hover:bg-slate-50",
                  !n.is_read && "bg-accent-light/50",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => markOne(n.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          n.priority === "URGENT" || n.priority === "HIGH"
                            ? "bg-[#ec3013]"
                            : "bg-blue-500",
                          n.is_read && "opacity-25",
                        )}
                      />
                      <span className="font-medium text-slate-900">
                        {n.title}
                      </span>
                      <span className="badge bg-slate-100 text-[10px] text-slate-600">
                        {n.category}
                      </span>
                    </div>
                    <div className="mt-1 break-words text-sm text-slate-600">
                      {n.message}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTime(n.created_at)}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {href && (
                      <Link href={href} className="btn-secondary h-8 text-xs">
                        Open
                      </Link>
                    )}
                    <button
                      onClick={() => clearOne(n)}
                      className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                      aria-label="Clear this notification"
                      title="Clear"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="p-10 text-center text-sm text-slate-500">
              No messages match.
            </li>
          )}
        </ul>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        busy={busy}
        title={
          confirm === "ALL"
            ? "Clear the whole inbox?"
            : "Clear read notifications?"
        }
        message={
          confirm === "ALL"
            ? `This permanently removes all ${items.length} notification${items.length === 1 ? "" : "s"}. Bookings, payments and audit history are unaffected.`
            : `This permanently removes ${readCount} read notification${readCount === 1 ? "" : "s"}. Unread ones stay.`
        }
        confirmLabel={confirm === "ALL" ? "Clear all" : "Clear read"}
        onConfirm={() => bulkClear(confirm ?? "ALL")}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
