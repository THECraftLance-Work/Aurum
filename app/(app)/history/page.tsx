import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import HistoryClient from "@/components/history/HistoryClient";
import { formatINR } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const own = ["SM","CP"].includes(user.role);

  const bq = own
    ? supabase.from("bookings")
        .select("id, booking_id, project_name, unit_number, status, total_property_value, total_amount_paid, created_at, updated_at, submitted_at, approved_at, rejection_reason")
        .eq("created_by", user.id)
    : supabase.from("bookings")
        .select("id, booking_id, project_name, unit_number, status, total_property_value, total_amount_paid, created_at, updated_at, submitted_at, approved_at, rejection_reason");

  const pq = own
    ? supabase.from("payments")
        .select("id, booking_id, amount, payment_date, payment_mode, status, created_at, reviewed_at, rejection_reason, booking:booking_id(booking_id)")
        .eq("submitted_by", user.id)
    : supabase.from("payments")
        .select("id, booking_id, amount, payment_date, payment_mode, status, created_at, reviewed_at, rejection_reason, booking:booking_id(booking_id)");

  const nq = supabase.from("notifications")
    .select("id, category, title, message, entity_type, entity_id, created_at, priority")
    .eq("recipient_user_id", user.id);

  const [{ data: bookings }, { data: payments }, { data: notifs }] = await Promise.all([bq, pq, nq]);

  type Entry = {
    id: string; kind: "BOOKING" | "PAYMENT" | "NOTIFICATION";
    title: string; description: string; when: string; href?: string; badge?: string;
  };
  const entries: Entry[] = [];
  (bookings ?? []).forEach((b: any) => {
    entries.push({
      id: `b-c-${b.id}`, kind: "BOOKING",
      title: `Booking ${b.booking_id} created`,
      description: `${b.project_name} · Unit ${b.unit_number} · ${formatINR(b.total_property_value)}`,
      when: b.created_at, href: `/bookings/${b.id}`, badge: "CREATED"
    });
    if (b.approved_at) entries.push({
      id: `b-a-${b.id}`, kind: "BOOKING",
      title: `Booking ${b.booking_id} approved`,
      description: `${b.project_name} · Unit ${b.unit_number}`,
      when: b.approved_at, href: `/bookings/${b.id}`, badge: "APPROVED"
    });
    if (b.status === "REJECTED" && b.rejection_reason) entries.push({
      id: `b-r-${b.id}`, kind: "BOOKING",
      title: `Booking ${b.booking_id} rejected`,
      description: b.rejection_reason,
      when: b.updated_at, href: `/bookings/${b.id}`, badge: "REJECTED"
    });
  });
  (payments ?? []).forEach((p: any) => {
    entries.push({
      id: `p-c-${p.id}`, kind: "PAYMENT",
      title: `Payment ${formatINR(p.amount)}`,
      description: `${p.booking?.booking_id ?? ""} · ${p.payment_mode.replaceAll("_"," ")}`,
      when: p.created_at, href: `/bookings/${p.booking_id}`, badge: p.status
    });
    if (p.reviewed_at) entries.push({
      id: `p-r-${p.id}`, kind: "PAYMENT",
      title: `Payment ${formatINR(p.amount)} ${p.status.toLowerCase()}`,
      description: p.rejection_reason ?? `${p.booking?.booking_id ?? ""}`,
      when: p.reviewed_at, href: `/bookings/${p.booking_id}`, badge: p.status
    });
  });
  (notifs ?? []).forEach((n: any) => {
    entries.push({
      id: `n-${n.id}`, kind: "NOTIFICATION",
      title: n.title, description: n.message,
      when: n.created_at,
      href: n.entity_type === "booking" ? `/bookings/${n.entity_id}` : undefined,
      badge: n.category
    });
  });
  entries.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  return (
    <>
      <PageHeader title="History" description="Everything you did and everything that happened to your records — bookings, payments, and messages." />
      {entries.length === 0
        ? <div className="card"><EmptyState title="No history yet" description="Your activity will appear here." /></div>
        : <HistoryClient entries={entries} />}
    </>
  );
}
