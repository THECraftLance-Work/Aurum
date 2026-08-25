"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Result = {
  kind: "booking" | "customer" | "user";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export default function GlobalSearch() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); inputRef.current?.focus(); setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const term = q.trim();
      const [bookings, customers, users] = await Promise.all([
        supabase.from("bookings")
          .select("id, booking_id, project_name, unit_number")
          .or(`booking_id.ilike.%${term}%,project_name.ilike.%${term}%,unit_number.ilike.%${term}%`)
          .limit(6),
        supabase.from("customers")
          .select("id, name, phone, email")
          .or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
          .limit(6),
        supabase.from("app_users")
          .select("id, name, email, role")
          .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
          .limit(6)
      ]);
      if (cancelled) return;
      const r: Result[] = [];
      bookings.data?.forEach((b: any) =>
        r.push({ kind: "booking", id: b.id, title: `${b.booking_id} · ${b.project_name}`, subtitle: `Unit ${b.unit_number}`, href: `/bookings/${b.id}` }));
      customers.data?.forEach((c: any) =>
        r.push({ kind: "customer", id: c.id, title: c.name, subtitle: [c.phone, c.email].filter(Boolean).join(" · "), href: `/bookings?customer=${c.id}` }));
      users.data?.forEach((u: any) =>
        r.push({ kind: "user", id: u.id, title: u.name, subtitle: `${u.role} · ${u.email}`, href: `/users?focus=${u.id}` }));
      setResults(r);
      setLoading(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, supabase]);

  function go(r: Result) {
    setOpen(false); setQ(""); router.push(r.href);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search bookings, customers, users…"
          className="input pl-9 pr-16 h-10"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1">
          <span className="kbd">Ctrl</span><span className="kbd">K</span>
        </span>
      </div>

      {open && (q.trim().length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border bg-white shadow-pop overflow-hidden">
          {loading && <div className="p-4 text-sm text-slate-500">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">No results</div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-96 overflow-y-auto py-2">
              {["booking","customer","user"].map((section) => {
                const group = results.filter((r) => r.kind === section);
                if (!group.length) return null;
                return (
                  <li key={section}>
                    <div className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-slate-400">{section}s</div>
                    {group.map((r) => (
                      <button
                        key={`${r.kind}-${r.id}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(r)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 text-xs">
                          {r.kind[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{r.title}</div>
                          {r.subtitle && <div className="text-xs text-slate-500 truncate">{r.subtitle}</div>}
                        </div>
                      </button>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
