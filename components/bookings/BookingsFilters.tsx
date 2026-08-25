"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useState, useEffect } from "react";

const STATUSES = ["", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "UPDATED"];

export default function BookingsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = params.get("status") ?? "";

  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (q) sp.set("q", q); else sp.delete("q");
      router.replace(`${pathname}?${sp.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line

  function setStatus(v: string) {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set("status", v); else sp.delete("status");
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="card mb-4 p-3 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9 h-10"
          placeholder="Search booking ID, project, unit…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`badge border h-8 px-3 ${status === s
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-border hover:bg-slate-50"}`}
          >
            {s ? s.replaceAll("_", " ") : "All"}
          </button>
        ))}
      </div>
    </div>
  );
}
