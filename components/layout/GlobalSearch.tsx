"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarPlus, CreditCard, FileText, LayoutDashboard, Search, UserRound, UsersRound, X } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/auth/session";

type Result = { kind: "booking" | "customer" | "user"; id: string; title: string; subtitle?: string; href: string };
type Action = { label: string; description: string; href: string; icon: typeof LayoutDashboard; roles: SessionUser["role"][]; shortcut?: string };

const actions: Action[] = [
  { label: "Open dashboard", description: "View today’s activity", href: "/dashboard", icon: LayoutDashboard, roles: ["SM", "CP", "ACCOUNTANT", "ADMIN", "DIRECTOR"] },
  { label: "Create new booking", description: "Start a new property booking", href: "/bookings/new", icon: CalendarPlus, roles: ["SM", "CP", "ADMIN", "DIRECTOR"], shortcut: "N" },
  { label: "View bookings", description: "Browse and manage all bookings", href: "/bookings", icon: FileText, roles: ["SM", "CP", "ACCOUNTANT", "ADMIN", "DIRECTOR"] },
  { label: "View payments", description: "Review payment activity", href: "/payments", icon: CreditCard, roles: ["SM", "CP", "ACCOUNTANT", "ADMIN", "DIRECTOR"] },
  { label: "View employees", description: "Manage team accounts", href: "/users", icon: UsersRound, roles: ["ADMIN", "DIRECTOR"] },
  { label: "Verification queue", description: "Review submitted payments", href: "/verification", icon: FileText, roles: ["ACCOUNTANT", "ADMIN", "DIRECTOR"] },
  { label: "User approvals", description: "Approve access requests", href: "/approvals", icon: UsersRound, roles: ["DIRECTOR"] },
  { label: "Audit logs", description: "Review organization activity", href: "/audit", icon: FileText, roles: ["ADMIN", "DIRECTOR"] },
];
const labels: Record<Result["kind"], string> = { booking: "Bookings", customer: "Customers", user: "Employees" };

export default function GlobalSearch({ user }: { user: SessionUser }) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const filteredActions = useMemo(() => {
    const term = query.trim().toLowerCase();
    const available = actions.filter((a) => a.roles.includes(user.role));
    return term ? available.filter((a) => `${a.label} ${a.description}`.toLowerCase().includes(term)) : available;
  }, [query, user.role]);
  const selectable = useMemo(() => query.trim() ? results : filteredActions, [query, results, filteredActions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen(true); requestAnimationFrame(() => inputRef.current?.focus());
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setActive(0);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const term = query.trim().replace(/[%,()\\.]/g, " ");
      const [bookings, customers, users] = await Promise.all([
        supabase.from("bookings").select("id, booking_id, project_name, unit_number").or(`booking_id.ilike.%${term}%,project_name.ilike.%${term}%,unit_number.ilike.%${term}%`).limit(6),
        supabase.from("customers").select("id, name, phone, email").or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`).limit(6),
        ["ADMIN", "DIRECTOR"].includes(user.role)
          ? supabase.from("app_users").select("id, name, email, role").or(`name.ilike.%${term}%,email.ilike.%${term}%`).limit(6)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const next: Result[] = [];
      bookings.data?.forEach((b: any) => next.push({ kind: "booking", id: b.id, title: `${b.booking_id} · ${b.project_name}`, subtitle: `Unit ${b.unit_number}`, href: `/bookings/${b.id}` }));
      customers.data?.forEach((c: any) => next.push({ kind: "customer", id: c.id, title: c.name, subtitle: [c.phone, c.email].filter(Boolean).join(" · "), href: `/bookings?customer=${c.id}` }));
      users.data?.forEach((u: any) => next.push({ kind: "user", id: u.id, title: u.name, subtitle: `${u.role} · ${u.email}`, href: `/users?focus=${u.id}` }));
      setResults(next); setLoading(false);
    }, 240);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, supabase, open, user.role]);

  function close() { setOpen(false); setQuery(""); }
  function go(href: string) { close(); router.push(href); }
  function keyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(selectable.length - 1, 0))); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && selectable[active]) { e.preventDefault(); go(selectable[active].href); }
  }
  const groups = (Object.keys(labels) as Result["kind"][]).map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) })).filter((g) => g.items.length);

  return <div ref={searchRef} className="relative">
    <div className={`relative transition-opacity duration-150 ${open ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <button type="button" onClick={() => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }} className="input flex h-10 w-full items-center pl-9 pr-16 text-left text-sm text-slate-400" aria-label="Search bookings, customers, and users">Search bookings, customers, users…</button>
      <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 sm:flex"><span className="kbd">Ctrl</span><span className="kbd">K</span></span>
    </div>
    {open && <div className="search-panel-enter absolute left-0 right-0 top-0 z-50" role="dialog" aria-modal="false" aria-label="Global search">
      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)]">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input ref={inputRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={keyDown} placeholder="Search bookings, customers, users…" aria-label="Search" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
          <button type="button" onClick={close} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close search"><X className="h-4 w-4" /></button><kbd className="kbd hidden sm:inline-flex">ESC</kbd>
        </div>
        <div className="max-h-[min(30rem,68vh)] overflow-y-auto p-2">
          {!query.trim() && <section><p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Quick actions</p>{filteredActions.map((a, i) => { const Icon = a.icon; return <button key={a.href} type="button" onClick={() => go(a.href)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === active ? "bg-slate-100" : "hover:bg-slate-50"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{a.label}</span><span className="block truncate text-xs text-slate-400">{a.description}</span></span>{a.shortcut && <kbd className="kbd">{a.shortcut}</kbd>}<ArrowRight className="h-4 w-4 text-slate-300" /></button>; })}</section>}
          {query.trim() && loading && <div className="px-3 py-10 text-center text-sm text-slate-500">Searching…</div>}
          {query.trim() && !loading && !results.length && <div className="px-3 py-10 text-center"><Search className="mx-auto mb-2 h-7 w-7 text-slate-300" /><p className="text-sm font-medium text-slate-700">No results found</p><p className="mt-1 text-xs text-slate-400">Try a booking ID, customer name, phone, or email.</p></div>}
          {query.trim() && !loading && groups.map((group) => <section key={group.kind} className="mb-2 last:mb-0"><p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{labels[group.kind]}</p>{group.items.map((r) => { const index = results.indexOf(r); return <button key={`${r.kind}-${r.id}`} type="button" onClick={() => go(r.href)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${index === active ? "bg-slate-100" : "hover:bg-slate-50"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">{r.kind === "booking" ? <FileText className="h-4 w-4" /> : r.kind === "customer" ? <UserRound className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{r.title}</span>{r.subtitle && <span className="block truncate text-xs text-slate-400">{r.subtitle}</span>}</span><ArrowRight className="h-4 w-4 text-slate-300" /></button>; })}</section>)}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-slate-50 px-4 py-2 text-[11px] text-slate-400"><span>Search across your workspace</span><span className="hidden items-center gap-2 sm:flex"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navigate <kbd className="kbd">Enter</kbd> open</span></div>
      </div>
    </div>}
  </div>;
}
