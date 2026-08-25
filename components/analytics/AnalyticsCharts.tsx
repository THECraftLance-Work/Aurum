"use client";
import dynamic from "next/dynamic";
import { SkeletonCard } from "@/components/ui/UIStates";

/**
 * Recharts is ~100KB gzipped and only this page needs it. Loading it lazily
 * keeps it out of the shared client bundle that every other route pays for.
 */
const ChartsInner = dynamic(() => import("./ChartsInner"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
});

export default function AnalyticsCharts({ bookings, payments }: { bookings: any[]; payments: any[] }) {
  return <ChartsInner bookings={bookings} payments={payments} />;
}
