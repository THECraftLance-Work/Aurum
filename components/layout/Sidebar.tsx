"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";
import { roleAccent, roleLabels } from "@/lib/utils/format";
import {
  LayoutDashboard, ClipboardList, Wallet, Inbox, BarChart3,
  ShieldCheck, UserCog, Users, ScrollText, Settings, X, History, Building2, User, LifeBuoy, MoreHorizontal, ChevronUp
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<any>; roles: SessionUser["role"][] };

const NAV: Item[] = [
  { href: "/dashboard",  label: "Dashboard",         icon: LayoutDashboard, roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/bookings",   label: "Bookings",          icon: ClipboardList,   roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/payments",   label: "Payments",          icon: Wallet,          roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/verification", label: "Verification Queue", icon: ShieldCheck,  roles: ["ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/approvals",  label: "User Approvals",    icon: UserCog,         roles: ["DIRECTOR"] },
  { href: "/users",      label: "Users",             icon: Users,           roles: ["ADMIN","DIRECTOR"] },
  { href: "/inbox",      label: "Inbox",             icon: Inbox,           roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/tickets",    label: "Support",           icon: LifeBuoy,        roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/analytics",  label: "Analytics",         icon: BarChart3,       roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/history",    label: "History",           icon: History,         roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/audit",      label: "Audit Logs",        icon: ScrollText,      roles: ["ADMIN","DIRECTOR"] },
  { href: "/profile",    label: "My Profile",        icon: User,            roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/settings",   label: "Settings",          icon: Settings,        roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] }
];

export default function Sidebar({
  user, mobileOpen, onMobileOpen, onMobileClose, pendingVerification = 0
}: {
  user: SessionUser;
  mobileOpen: boolean;
  onMobileOpen: () => void;
  onMobileClose: () => void;
  /** Payments awaiting verification — badged on the Verification Queue entry. */
  pendingVerification?: number;
}) {
  const pathname = usePathname();
  const accent = roleAccent[user.role];
  const items = NAV.filter((i) => i.roles.includes(user.role));
  const primaryItems = items.slice(0, 4);
  const moreItems = items.slice(4);

  const content = (
    <div className="flex h-full w-72 flex-col bg-white border-r border-border">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white text-sm font-bold shadow-card">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-slate-900">Aurum Real Estate</div>
            <div className="text-[11px] leading-tight text-slate-500">Operations</div>
          </div>
        </Link>
        <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100" onClick={onMobileClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className={cn("rounded-xl border px-3 py-2 text-xs flex items-center gap-2", accent.chip)}>
          <span className={cn("h-2 w-2 rounded-full", accent.dot)} />
          <span className="font-medium">{roleLabels[user.role]}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onMobileClose}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium mb-1 transition",
                active
                  ? "bg-slate-900 text-white shadow-card"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-500 group-hover:text-slate-700")} />
              <span className="min-w-0 flex-1 truncate">{it.label}</span>

              {/* Work waiting on this user: a pulsing count, so a queue that
                  needs action is visible from any page. */}
              {it.href === "/verification" && pendingVerification > 0 && (
                <span
                  aria-label={`${pendingVerification} awaiting verification`}
                  className={cn(
                    "animate-badge-pulse inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                    active ? "bg-white text-slate-900" : "bg-[#ec3013] text-white"
                  )}
                >
                  {pendingVerification > 99 ? "99+" : pendingVerification}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/profile"
          onClick={onMobileClose}
          className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-100 transition-colors group"
          title="View profile"
        >
          <div className={cn("grid h-9 w-9 place-items-center rounded-full text-white font-semibold", accent.dot)}>
            {user.name.split(" ").slice(0,2).map(s => s[0]?.toUpperCase()).join("")}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900 group-hover:text-[#ec3013] transition-colors">{user.name}</div>
            <div className="truncate text-xs text-slate-500">{user.email}</div>
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile bottom navigation and expandable menu */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur xl:hidden">
        <nav className="grid h-16 grid-cols-5 items-stretch px-1" aria-label="Mobile navigation">
          {primaryItems.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            const Icon = it.icon;
            return <Link key={it.href} href={it.href} onClick={onMobileClose} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium", active ? "text-slate-900" : "text-slate-500")}>
              <span className={cn("grid h-7 w-9 place-items-center rounded-lg", active && "bg-slate-900 text-white")}><Icon className="h-4 w-4" /></span>
              <span className="max-w-full truncate">{it.label.replace(" Queue", "")}</span>
            </Link>;
          })}
          {moreItems.length > 0 && <button type="button" onClick={() => mobileOpen ? onMobileClose() : onMobileOpen()} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium", mobileOpen ? "text-slate-900" : "text-slate-500")} aria-expanded={mobileOpen} aria-label="Open more navigation options">
            <span className={cn("grid h-7 w-9 place-items-center rounded-lg", mobileOpen && "bg-slate-900 text-white")}><MoreHorizontal className="h-4 w-4" /></span><span>More</span>
          </button>}
        </nav>
      </div>

      {moreItems.length > 0 && <div className={cn("fixed inset-0 z-30 xl:hidden transition", mobileOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <button type="button" aria-label="Close navigation menu" onClick={onMobileClose} className={cn("absolute inset-0 bg-slate-950/35 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} />
        <div className={cn("absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-3 shadow-[0_-16px_48px_rgba(15,23,42,0.2)] transition-transform duration-300 ease-out", mobileOpen ? "translate-y-0" : "translate-y-full")}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900">More sections</h2><p className="text-xs text-slate-500">{roleLabels[user.role]} workspace</p></div><button type="button" onClick={onMobileClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close menu"><ChevronUp className="h-5 w-5" /></button></div>
          <nav className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto" aria-label="More navigation">
            {moreItems.map((it) => { const active = pathname === it.href || pathname.startsWith(it.href + "/"); const Icon = it.icon; return <Link key={it.href} href={it.href} onClick={onMobileClose} className={cn("flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-center text-xs font-medium", active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}><Icon className="h-5 w-5" /><span>{it.label}</span>{it.href === "/verification" && pendingVerification > 0 && <span className="absolute" aria-label={`${pendingVerification} awaiting verification`} />}</Link>; })}
          </nav>
        </div>
      </div>}

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden xl:block">{content}</aside>
    </>
  );
}
