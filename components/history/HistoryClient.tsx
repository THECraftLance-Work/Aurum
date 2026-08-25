"use client";
import { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Search, ClipboardList, Wallet, Bell } from "lucide-react";

type Entry = {
  id: string; kind: "BOOKING" | "PAYMENT" | "NOTIFICATION";
  title: string; description: string; when: string; href?: string; badge?: string;
};

const KIND_ICONS = {
  BOOKING: ClipboardList,
  PAYMENT: Wallet,
  NOTIFICATION: Bell
};
const KIND_COLORS = {
  BOOKING: "bg-blue-50 text-blue-600",
  PAYMENT: "bg-emerald-50 text-emerald-600",
  NOTIFICATION: "bg-violet-50 text-violet-600"
};

export default function HistoryClient({ entries }: { entries: Entry[] }) {
  const [kind, setKind] = useState<"ALL" | Entry["kind"]>("ALL");
  const [q, setQ] = useState("");

  const filtered = entries.filter((e) => {
    if (kind !== "ALL" && e.kind !== kind) return false;
    if (q && !`${e.title} ${e.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const kinds: ("ALL" | Entry["kind"])[] = ["ALL","BOOKING","PAYMENT","NOTIFICATION"];

  return (
    <div className="card p-0 overflow-hidden">
      <div className="border-b border-border p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9 h-10" placeholder="Search history…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {kinds.map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={cn("badge border h-8 px-3",
                kind === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-border hover:bg-slate-50")}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <ol className="relative">
        {filtered.map((e, i) => {
          const Icon = KIND_ICONS[e.kind];
          const color = KIND_COLORS[e.kind];
          const inner = (
            <div className="flex gap-4 items-start p-4 hover:bg-slate-50 transition">
              <div className={cn("grid h-9 w-9 place-items-center rounded-xl shrink-0", color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-slate-900">{e.title}</div>
                  {e.badge && <span className="badge bg-slate-100 text-slate-600 text-[10px]">{e.badge}</span>}
                </div>
                <div className="mt-0.5 text-sm text-slate-600 truncate">{e.description}</div>
                <div className="mt-0.5 text-xs text-slate-400">{formatDateTime(e.when)}</div>
              </div>
            </div>
          );
          return (
            <li key={e.id} className="border-b border-border last:border-0">
              {e.href ? <Link href={e.href}>{inner}</Link> : inner}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="p-10 text-center text-sm text-slate-500">No entries match.</li>
        )}
      </ol>
    </div>
  );
}
