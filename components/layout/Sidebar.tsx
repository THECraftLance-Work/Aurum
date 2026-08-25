"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";
import { roleAccent, roleLabels } from "@/lib/utils/format";
import {
  LayoutDashboard, ClipboardList, Wallet, Inbox, BarChart3,
  ShieldCheck, UserCog, Users, ScrollText, Settings, X, History, Building2, User, LifeBuoy
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
  user, mobileOpen, onMobileClose
}: { user: SessionUser; mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const accent = roleAccent[user.role];
  const items = NAV.filter((i) => i.roles.includes(user.role));

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
              <Icon className={cn("h-4 w-4", active ? "text-white" : "text-slate-500 group-hover:text-slate-700")} />
              {it.label}
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
      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-40 lg:hidden transition", mobileOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <div
          className={cn("absolute inset-0 bg-slate-900/40 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")}
          onClick={onMobileClose}
        />
        <div className={cn(
          "absolute left-0 top-0 h-full transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>{content}</div>
      </div>

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block">{content}</aside>
    </>
  );
}
