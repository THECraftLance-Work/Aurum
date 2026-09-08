import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import HistoryClient from "@/components/history/HistoryClient";
import { formatINR } from "@/lib/utils/format";
import { getProjectScopeIds } from "@/lib/utils/projectScope";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const rawProject = (await cookies()).get("srivaraha_project")?.value ?? null;
  const projectId = rawProject && rawProject.trim() ? rawProject.trim() : null;
  const scopeIds = await getProjectScopeIds(supabase, projectId);
  const own = ["SM","CP"].includes(user.role);

  /**
   * This page is a merged activity timeline, so it only ever renders the most
   * recent slice. Each query is ordered newest-first and capped.
   */
  const WINDOW = 200;

  let bq: any = own
    ? supabase.from("bookings").select("id, booking_id, project_name, unit_number, status, total_property_value, total_amount_paid, created_at, updated_at, submitted_at, approved_at, rejection_reason, project_id").eq("created_by", user.id)
    : supabase.from("bookings").select("id, booking_id, project_name, unit_number, status, total_property_value, total_amount_paid, created_at, updated_at, submitted_at, approved_at, rejection_reason, project_id");
  if (scopeIds) bq = bq.in("project_id", scopeIds);
  bq = bq.order("created_at", { ascending: false }).limit(WINDOW);

  let pq: any = supabase.from("payments").select("id, booking_id, amount, payment_date, payment_mode, status, created_at, reviewed_at, rejection_reason, project_id, booking:booking_id(booking_id)").eq("submitted_by", user.id);
  if (!own) pq = supabase.from("payments").select("id, booking_id, amount, payment_date, payment_mode, status, created_at, reviewed_at, rejection_reason, project_id, booking:booking_id(booking_id)");
  else pq = pq.eq("submitted_by", user.id);
  if (scopeIds) pq = pq.in("project_id", scopeIds);
  pq = pq.order("created_at", { ascending: false }).limit(WINDOW);

  let nq: any = supabase.from("notifications").select("id, category, title, message, entity_type, entity_id, created_at, priority, project_id").eq("recipient_user_id", user.id);
  if (scopeIds && scopeIds.length > 0) {
    const scopeOr = scopeIds.map(id => `project_id.eq.${id}`).join(",");
    nq = nq.or(`${scopeOr},project_id.is.null`);
  }
  nq = nq.order("created_at", { ascending: false }).limit(WINDOW);

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
