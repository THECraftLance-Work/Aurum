import { SkeletonCard, SkeletonRow } from "@/components/ui/UIStates";

/**
 * Layout-matched skeleton for every page inside the app shell.
 *
 * Replaces the branded PremiumLoader, whose fake progress bar creeping to 92%
 * made navigation *feel* slower than it was. A skeleton in the shape of the
 * real content reads as instant.
 */
export default function AppLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded-lg bg-slate-100" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card overflow-hidden p-0 lg:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
          </div>
          <table className="w-full">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
            </tbody>
          </table>
        </div>
        <SkeletonCard />
      </div>
    </div>
  );
}
