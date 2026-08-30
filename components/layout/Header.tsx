"use client";
import { useRouter } from "next/navigation";
import { Bell, LogOut, LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/auth/session";
import GlobalSearch from "./GlobalSearch";
import NotificationsDrawer from "@/components/notifications/NotificationsDrawer";
import RaiseTicketModal from "@/components/tickets/RaiseTicketModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { isNotificationCategoryEnabled, playNotificationSound, showBrowserNotification } from "@/lib/utils/notification-client";

export default function Header({ user }: { user: SessionUser }) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [unread, setUnread] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { count } = await supabase
        .from("notifications").select("id", { count: "exact", head: true })
        .eq("recipient_user_id", user.id).eq("is_read", false);
      if (alive) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
        (payload) => {
          const notification = payload.new as { category?: string; priority?: string; title?: string; message?: string };
          if (!isNotificationCategoryEnabled(notification.category ?? "")) return;
          if (["HIGH", "URGENT"].includes(notification.priority ?? "")) playNotificationSound();
          showBrowserNotification(notification.title ?? "Aurum notification", notification.message ?? "You have a new update.");
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
        load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [supabase, user.id]);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="flex h-14 w-full items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 max-w-xl flex-1 items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <GlobalSearch user={user} />
            </div>
          </div>

          {/*
            The "New booking" button used to live here and was rendered on every
            page, duplicating the identical button already present in the
            Dashboard and Bookings page headers. Page-level PageHeader actions
            own that affordance now.
          */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setTicketOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
              aria-label="Raise a support ticket"
              title="Raise a support ticket"
            >
              <LifeBuoy className="h-4 w-4 text-slate-600" />
              <span className="hidden text-xs font-semibold text-slate-700 xl:inline">Raise a Ticket</span>
            </button>

            <button
              onClick={() => setDrawer(true)}
              className="relative rounded-xl border border-border bg-white p-2.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              title="Notifications"
            >
              <Bell className="h-4 w-4 text-slate-600" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-[#ec3013] px-1 text-[11px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>

            <button onClick={() => setConfirmSignOut(true)} className="btn-secondary h-10 shadow-sm" title="Sign out">
              <LogOut className="h-4 w-4 text-slate-600" />
              <span className="hidden font-medium sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <NotificationsDrawer user={user} open={drawer} onClose={() => setDrawer(false)} />
      <RaiseTicketModal open={ticketOpen} onClose={() => setTicketOpen(false)} />

      {/* Signing out mid-task loses anything unsaved (a half-filled booking
          form, a payment being reviewed), so it asks first. */}
      <ConfirmDialog
        open={confirmSignOut}
        busy={signingOut}
        tone="primary"
        title="Sign out of Aurum?"
        message={
          <>
            You are signed in as <span className="font-medium">{user.name}</span>.
            Any unsaved work on this page will be lost.
          </>
        }
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={signOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </>
  );
}
