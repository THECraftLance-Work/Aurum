import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import AnalyticsCharts from "@/components/analytics/AnalyticsCharts";
import DateRangeFilter from "@/components/analytics/DateRangeFilter";
import { resolveRange, isRangeKey, DEFAULT_RANGE } from "@/lib/utils/date-range";
import { formatINR } from "@/lib/utils/format";
import { TrendingUp, Wallet, Clock, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams
}: { searchParams: { range?: string } }) {
  const user = await requireUser();
  const supabase = createSupabaseServer();

  const rangeKey = isRangeKey(searchParams.range) ? searchParams.range : DEFAULT_RANGE;
  const { since, label } = resolveRange(rangeKey);

  const own = ["SM", "CP"].includes(user.role);

  // Server-side date filtering keeps the RSC payload small — this page used to
  // ship two entire tables to the client.
  let bq = supabase
    .from("bookings")
    .select("id, project_name, status, total_property_value, total_amount_paid, remaining_balance, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  let pq = supabase
    .from("payments")
    .select("id, amount, payment_date, payment_mode, status, submitted_by")
    .order("payment_date", { ascending: false })
    .limit(4000);

  if (since) {
    bq = bq.gte("created_at", since);
    pq = pq.gte("payment_date", since.slice(0, 10));
  }
  if (own) {
    bq = bq.eq("created_by", user.id);
    pq = pq.eq("submitted_by", user.id);
  }

  const [{ data: bookings }, { data: payments }] = await Promise.all([bq, pq]);

  const rows = bookings ?? [];
  const totalBookings = rows.length;
  const totalValue = rows.reduce((s, r: any) => s + Number(r.total_property_value ?? 0), 0);
  const totalReceived = rows.reduce((s, r: any) => s + Number(r.total_amount_paid ?? 0), 0);
  const pending = rows.reduce((s, r: any) => s + Number(r.remaining_balance ?? 0), 0);
  const collectionRate = totalValue > 0 ? Math.round((totalReceived / totalValue) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Business performance and workflow metrics · ${label}`}
        actions={<DateRangeFilter current={rangeKey} />}
      />

      <div className="stagger-children mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div style={{ ["--stagger" as any]: 0 }}>
          <StatCard label="Total bookings" value={totalBookings} tone="blue" icon={<ClipboardList className="h-4 w-4" />} />
        </div>
        <div style={{ ["--stagger" as any]: 1 }}>
          <StatCard label="Total property value" value={formatINR(totalValue)} tone="violet" icon={<TrendingUp className="h-4 w-4" />} />
        </div>
        <div style={{ ["--stagger" as any]: 2 }}>
          <StatCard label="Total collected" value={formatINR(totalReceived)} sublabel={`${collectionRate}% of pipeline value`} tone="emerald" icon={<Wallet className="h-4 w-4" />} />
        </div>
        <div style={{ ["--stagger" as any]: 3 }}>
          <StatCard label="Pending balance" value={formatINR(pending)} tone="amber" icon={<Clock className="h-4 w-4" />} />
        </div>
      </div>

      <AnalyticsCharts bookings={rows} payments={payments ?? []} />
    </>
  );
}
