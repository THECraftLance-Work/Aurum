"use client";
import { useRouter } from "next/navigation";
import { Bell, Menu, LogOut, LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/auth/session";
import GlobalSearch from "./GlobalSearch";
import NotificationsDrawer from "@/components/notifications/NotificationsDrawer";
import RaiseTicketModal from "@/components/tickets/RaiseTicketModal";

export default function Header({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [unread, setUnread] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

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
        { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
        load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [supabase, user.id]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 flex-1 max-w-xl min-w-0">
            <button
              className="lg:hidden rounded-lg p-2 transition-colors hover:bg-slate-100"
              onClick={onMenu}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <GlobalSearch />
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
              className="rounded-xl border border-border bg-white p-2.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
              aria-label="Raise a support ticket"
              title="Raise a support ticket"
            >
              <LifeBuoy className="h-4 w-4 text-slate-600" />
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

            <button onClick={signOut} className="btn-secondary h-10 shadow-sm" title="Sign out">
              <LogOut className="h-4 w-4 text-slate-600" />
              <span className="hidden font-medium sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <NotificationsDrawer user={user} open={drawer} onClose={() => setDrawer(false)} />
      <RaiseTicketModal open={ticketOpen} onClose={() => setTicketOpen(false)} />
    </>
  );
}
