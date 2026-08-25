import { cn } from "@/lib/utils/cn";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function StatCard({
  label, value, sublabel, trend, icon, tone = "slate"
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  trend?: number;
  icon?: React.ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber" | "violet" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-50 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600"
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
          {sublabel && <div className="mt-1 text-xs text-slate-500">{sublabel}</div>}
        </div>
        {icon && <div className={cn("grid h-9 w-9 place-items-center rounded-xl", tones[tone])}>{icon}</div>}
      </div>
      {trend !== undefined && (
        <div className={cn("mt-3 inline-flex items-center gap-1 text-xs font-medium",
          trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
          {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}
