"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, CheckCheck, Inbox, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils/format";
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
  project_id?: string | null;
};

function getCurrentProjectId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )srivaraha_project=([^;]*)/)?.[1];
  if (m) return decodeURIComponent(m);
  try { return localStorage.getItem("srivaraha_project"); } catch { return null; }
}

function entityHref(n: Notif) {
  if (!n.entity_id) return null;
  if (n.entity_type === "booking") return `/bookings/${n.entity_id}`;
  if (n.entity_type === "ticket") return `/tickets/${n.entity_id}`;
  if (n.entity_type === "user") return "/approvals";
  return null;
}

export default function NotificationsDrawer({
  user, open, onClose
}: { user: SessionUser; open: boolean; onClose: () => void }) {
  const supabase = createSupabaseBrowser();
  const { toast } = useToast();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(()=> setMounted(true), []);
  useEffect(() => {
    const refresh = () => setProjectId(getCurrentProjectId());
    refresh();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === "srivaraha_project") refresh(); };
    const onCustom = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("srivaraha:project", onCustom as any);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("srivaraha:project", onCustom as any); };
  }, []);
  // Re-fetch when project changes while open
  useEffect(() => {
    const onProject = () => { if (open) setLoading(true); };
    window.addEventListener("srivaraha:project", onProject as any);
    return () => window.removeEventListener("srivaraha:project", onProject as any);
  }, [open]);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const pid = getCurrentProjectId();
      let q: any = supabase
        .from("notifications")
        .select("*")
        .eq("recipient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (pid) q = q.eq("project_id", pid);
      const { data } = await q;
      // pid set → strictly that project's notifications (matches inbox/history semantics)
      setItems(data ?? []);
      setLoading(false);
    })();
  }, [open, supabase, user.id, projectId]);

  async function markAllRead() {
    const unread = items.filter((n) => !n.is_read);
    if (!unread.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true })
      .eq("recipient_user_id", user.id).eq("is_read", false);
  }

  async function markOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  /** Optimistic delete. `.select()` returns the deleted rows — an empty result
   *  means RLS blocked it (the DELETE policy ships in migration 0002), which
   *  would otherwise look like success until the next refresh. */
  async function clearOne(n: Notif) {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    const { data, error } = await supabase.from("notifications").delete().eq("id", n.id).select("id");
    if (error || !data?.length) {
      setItems((prev) => [n, ...prev].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)));
      toast({
        tone: "error",
        title: "Could not clear notification",
        description: error?.message ?? "Clearing is not enabled yet — apply migration 0002."
      });
      return;
    }
    toast({ tone: "info", title: "Notification cleared", duration: 3000 });
  }

  async function clearAll() {
    setBusy(true);
    const snapshot = items;
    setItems([]);
    const { data, error } = await supabase
      .from("notifications").delete().eq("recipient_user_id", user.id).select("id");
    setBusy(false);
    setConfirmClear(false);
    if (error || !data?.length) {
      setItems(snapshot);
      toast({
        tone: "error",
        title: "Could not clear notifications",
        description: error?.message ?? "Clearing is not enabled yet — apply migration 0002."
      });
      return;
    }
    toast({ tone: "success", title: "All notifications cleared", description: `${data.length} removed.` });
  }

  const drawer = (
    <>
      <div className={cn("fixed inset-0 z-50 transition", open ? "pointer-events-auto" : "pointer-events-none")}>
        <div
          className={cn("absolute inset-0 bg-black/50 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
          onClick={onClose}
        />
        <aside className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out-quint",
          open ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={markAllRead} className="btn-secondary h-8 px-2 text-xs" title="Mark all as read">
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
              <button
                onClick={() => setConfirmClear(true)}
                disabled={items.length === 0}
                className="btn-secondary h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                title="Clear all notifications"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear all</span>
              </button>
              <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-6 text-sm text-slate-500">Loading…</div>}
            {!loading && items.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">You&apos;re all caught up.</div>
            )}
            {items.map((n) => {
              const href = entityHref(n);
              return (
                <div
                  key={n.id}
                  className={cn(
                    "group flex items-start gap-3 border-b border-border px-5 py-4 transition-colors hover:bg-slate-50",
                    !n.is_read && "bg-accent-light/50"
                  )}
                >
                  <span className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.priority === "URGENT" || n.priority === "HIGH" ? "bg-[#ec3013]" : "bg-blue-500",
                    n.is_read && "opacity-25"
                  )} />
                  <button onClick={() => markOne(n.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium text-slate-900">{n.title}</div>
                      <div className="shrink-0 text-[11px] text-slate-500">{formatDateTime(n.created_at)}</div>
                    </div>
                    <div className="mt-0.5 break-words text-sm text-slate-600">{n.message}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="badge bg-slate-100 text-slate-600">{n.category}</span>
                      {href && (
                        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">Open <ArrowRight className="h-3 w-3" /></Link>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => clearOne(n)}
                    className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                    aria-label="Clear this notification"
                    title="Clear"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        busy={busy}
        title="Clear all notifications?"
        message={`This permanently removes all ${items.length} notification${items.length === 1 ? "" : "s"} from your inbox. Bookings, payments and audit history are unaffected.`}
        confirmLabel="Clear all"
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );

  if (!mounted) return null;
  return createPortal(drawer, document.body);
}
