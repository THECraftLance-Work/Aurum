"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { CalendarRange } from "lucide-react";
import { RANGE_OPTIONS } from "@/lib/utils/date-range";

export default function DateRangeFilter({ current }: { current: string }) {
  const params = useSearchParams();

  function href(key: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("range", key);
    return `/analytics?${sp.toString()}`;
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarRange className="hidden h-4 w-4 text-slate-400 sm:block" />
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-white p-1 shadow-card">
        {RANGE_OPTIONS.map((o) => (
          <Link
            key={o.key}
            href={href(o.key)}
            scroll={false}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150",
              current === o.key
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
