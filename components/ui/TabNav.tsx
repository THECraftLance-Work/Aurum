"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export type TabItem = { key: string; label: string; badge?: number | null };

/**
 * Tab bar with an immediate pending state.
 *
 * These pages are `force-dynamic`, so switching tabs is a server round-trip.
 * As plain <Link>s a click did nothing visible until the new HTML arrived,
 * which reads as the app being slow. This marks the clicked tab active at once
 * and dims the outgoing content while the server responds — the work takes the
 * same time, it just stops feeling broken.
 */
export default function TabNav({
  tabs,
  active,
  hrefFor,
  className
}: {
  tabs: TabItem[];
  active: string;
  hrefFor: (key: string) => string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);

  // Once the server render lands, `active` is authoritative again.
  useEffect(() => { setOptimistic(null); }, [active]);

  const shown = optimistic ?? active;

  return (
    <div
      className={cn(
        "mb-4 flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-border bg-white p-1 shadow-card transition-opacity duration-150",
        pending && "opacity-70",
        className
      )}
    >
      {tabs.map((t) => {
        const isActive = shown === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              if (t.key === active) return;
              setOptimistic(t.key);
              startTransition(() => router.push(hrefFor(t.key), { scroll: false }));
            }}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-150",
              isActive ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {t.label}
            {t.badge ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                )}
              >
                {t.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
