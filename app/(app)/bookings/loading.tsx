import { SkeletonRow } from "@/components/ui/UIStates";

/**
 * Per-route skeleton. Next.js streams this the moment navigation starts, so a
 * click paints immediately instead of waiting on the server round-trip these
 * force-dynamic pages require.
 */
export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="mb-4 h-12 w-full max-w-md animate-pulse rounded-2xl bg-slate-100" />
      <div className="card overflow-hidden p-0">
        <div className="border-b border-border bg-slate-50 px-5 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        <table className="w-full">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
