import { cn } from "@/lib/utils/cn";
import { statusBadge } from "@/lib/utils/format";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("badge", statusBadge[status] ?? "bg-slate-100 text-slate-700")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {status.replaceAll("_", " ")}
    </span>
  );
}
