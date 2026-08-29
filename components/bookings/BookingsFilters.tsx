"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STATUSES = ["", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "UPDATED"];

export default function BookingsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQ = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const [q, setQ] = useState(urlQ);
  // Optimistic status so the chip highlights before the server responds.
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const firstRender = useRef(true);

  useEffect(() => { setOptimisticStatus(null); }, [status]);

  // Keep the box in sync when the URL changes from elsewhere (back button).
  useEffect(() => { setQ(urlQ); }, [urlQ]);

  useEffect(() => {
    // Don't fire a navigation for the initial mount value.
    if (firstRender.current) { firstRender.current = false; return; }
    if (q === urlQ) return;

    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (q) sp.set("q", q); else sp.delete("q");
      sp.delete("page"); // a new search starts at page 1
      startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setStatus(v: string) {
    if (v === status) return;
    setOptimisticStatus(v);
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set("status", v); else sp.delete("status");
    sp.delete("page");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  const shownStatus = optimisticStatus ?? status;

  return (
    <div className={cn("card mb-4 flex flex-wrap items-center gap-2 p-3 transition-opacity duration-150", pending && "opacity-70")}>
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input h-10 pl-9 pr-16"
          placeholder="Search booking ID, project, unit…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          {q && !pending && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={shownStatus === s}
            className={cn(
              "badge h-8 border px-3 transition-all duration-150",
              shownStatus === s
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-border bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {s ? s.replaceAll("_", " ") : "All"}
          </button>
        ))}
      </div>
    </div>
  );
}
