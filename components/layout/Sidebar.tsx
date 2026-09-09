"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";
import { roleAccent, roleLabels } from "@/lib/utils/format";
import PremiumLoader from "@/components/ui/PremiumLoader";
import {
  LayoutDashboard, ClipboardList, Wallet, Inbox, BarChart3,
  ShieldCheck, UserCog, Users, ScrollText, Settings, X, History, Building2, User, LifeBuoy, MoreHorizontal, ChevronUp, ChevronDown
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<any>; roles: SessionUser["role"][] };

const NAV: Item[] = [
  { href: "/dashboard",  label: "Dashboard",         icon: LayoutDashboard, roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/bookings",   label: "Bookings",          icon: ClipboardList,   roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/payments",   label: "Payments",          icon: Wallet,          roles: ["SM","CP","ACCOUNTANT","ADMIN","DIRECTOR"] },
  { href: "/verification", label: "Verification Queue", icon: ShieldCheck,  roles: ["ACCOUNTANT","DIRECTOR"] },
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
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [currentProject, setCurrentProject] = useState<string>("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmProject, setConfirmProject] = useState<any | null>(null);
  const refreshProject = () => {
    const c = document.cookie.match(/(?:^|; )srivaraha_project=([^;]*)/)?.[1];
    const val = c ? decodeURIComponent(c) : (typeof window !== "undefined" ? localStorage.getItem("srivaraha_project") ?? "" : "");
    setCurrentProject(val);
  };
  useEffect(() => {
    fetch("/api/projects").then(r=>r.json()).then(j=> setProjects(j.projects ?? [])).catch(()=>{});
    refreshProject();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === "srivaraha_project") refreshProject(); };
    const onCustom = () => refreshProject();
    window.addEventListener("storage", onStorage);
    window.addEventListener("srivaraha:project", onCustom as any);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("srivaraha:project", onCustom as any); };
  }, []);
  function selectProject(id: string) {
    const project = projects.find((item: any) => item.id === id);
    if (!project || id === currentProject) return;
    setConfirmProject(project);
  }
  function confirmSwitch() {
    const id = confirmProject?.id as string | undefined;
    if (!id) return;
    setConfirmProject(null);
    document.cookie = `srivaraha_project=${encodeURIComponent(id)}; path=/; max-age=31536000`;
    document.cookie = `srivaraha_onboarded=1; path=/; max-age=315360000`;
    localStorage.setItem("srivaraha_project", id);
    try { localStorage.setItem("srivaraha_onboarded", "1"); } catch {}
    setCurrentProject(id);
    setProjectOpen(false);
    window.dispatchEvent(new CustomEvent("srivaraha:project", { detail: id }));
    window.dispatchEvent(new StorageEvent("storage", { key: "srivaraha_project", newValue: id } as any));
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }
  const parentProject = projects.find((p: any) => p.slug === "sri-varaha");
  const subProjects = projects.filter((p: any) => p.slug !== "sri-varaha");
  const isPrivileged = ["ADMIN", "DIRECTOR"].includes(user.role);
  const activeProj = projects.find((p: any) => p.id === currentProject);
  useEffect(() => {
    const logo = activeProj?.logo_url;
    document.title = activeProj ? `${activeProj.name} — Real Estate Operations` : "Aurum — Real Estate Operations";
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = logo || "/favicon.svg";
  }, [activeProj]);
  const currentProjectName = activeProj ? activeProj.name : isPrivileged ? "All Projects (Sri Varaha)" : "Select project";
  const accent = roleAccent[user.role];
  const items = NAV.filter((i) => i.roles.includes(user.role));
  const primaryItems = items.slice(0, 4);
  const moreItems = items.slice(4);

  const content = (
    <div className="relative flex h-full w-72 flex-col bg-white border-r border-border">
      {isPending && (
        <PremiumLoader message="Loading project dashboard..." submessage="Fetching secure project data" />
      )}
      {confirmProject && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-slate-900">Switch project?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to switch to <strong>{confirmProject.name}</strong>?
              The dashboard, bookings, and payments will update to this project.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmProject(null)} className="btn-secondary h-10">Cancel</button>
              <button type="button" onClick={confirmSwitch} className="btn-primary h-10">Yes, switch</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-2 py-5 gap-2">
        <div className="relative flex-1">
          <button onClick={()=> setProjectOpen(v=>!v)} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2.5 text-left hover:bg-slate-800 transition-colors">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white shrink-0 overflow-hidden">
              {activeProj?.logo_url ? <img src={activeProj.logo_url} alt="" className="h-full w-full object-contain" /> : <Building2 className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight text-white truncate">{activeProj?.name ?? "Sri Varaha Operations"}</div>
              <div className="text-[11px] leading-tight text-white/70 truncate">{activeProj?.parent_id ? "Sub-project" : "Workspace"} • {currentProjectName}</div>
            </div>
            <ChevronDown className={`h-4 w-4 text-white/70 shrink-0 transition-transform ${projectOpen ? "rotate-180" : ""}`} />
          </button>
          {projectOpen && (
            <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
              <div className="max-h-64 overflow-y-auto py-1">



                <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 border-t border-slate-100">Sub-Projects</div>
                {subProjects.length===0 && <div className="px-3 py-2 text-xs text-slate-500">No sub-projects</div>}
                {subProjects.map((p:any)=>(
                  <button key={p.id} onClick={()=> selectProject(p.id)} className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 ${currentProject===p.id ? "bg-red-50 text-[#ec3013] font-semibold" : "text-slate-700"}`}>
                    <span className="truncate pl-2 flex items-center gap-1.5">
                      <span>{p.name}</span>
                      <span className="text-xs text-slate-400 font-normal">({p.slug})</span>
                    </span>
                    {currentProject===p.id && <span className="h-2 w-2 rounded-full bg-[#ec3013]" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-200 p-2">
                <Link href="/projects" onClick={()=> setProjectOpen(false)} className="block rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium text-white hover:bg-slate-800">Manage Projects</Link>
              </div>
            </div>
          )}
        </div>
        <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 shrink-0" onClick={onMobileClose}>
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
