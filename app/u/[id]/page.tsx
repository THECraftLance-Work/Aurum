import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import UserDetailClient from "@/components/users/UserDetailClient";
import type { DocUrl } from "@/components/users/UserDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicUserDetail({
  params,
}: {
  params: { id: string };
}) {
  const admin = createSupabaseAdmin();

  const { data: u, error: userErr } = await admin
    .from("app_users")
    .select(
      "id, name, email, phone, role, status, auth_provider, employee_id, requested_role, avatar_url, approved_at, last_login_at, created_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (userErr || !u) notFound();

  // Bookings + tickets in parallel; attachments per booking fetched after we know ids.
  const [{ data: rawBookings }, { data: rawTickets }] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "*, customer:customer_id(id, name, phone, email)"
      )
      .eq("created_by", u.id)
      .order("created_at", { ascending: false }),
    admin
      .from("tickets")
      .select("*")
      .eq("raised_by", u.id)
      .order("created_at", { ascending: false }),
  ]);

  const bookingIds: string[] = (rawBookings ?? []).map((b: any) => b.id);
  const ticketIds: string[] = (rawTickets ?? []).map((t: any) => t.id);

  const [paymentsByBooking, attachmentsByBooking, ticketComments, userAttachments] =
    await Promise.all([
      bookingIds.length
        ? admin.from("payments").select("*, submitter:submitted_by(name), reviewer:reviewed_by(name)").in("booking_id", bookingIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] } as any),
      bookingIds.length
        ? admin.from("attachments").select("id, entity_type, entity_id, file_name, file_size, mime_type, label, created_at, uploader:uploaded_by(name)").eq("entity_type", "booking").in("entity_id", bookingIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] } as any),
      ticketIds.length
        ? admin.from("ticket_comments").select("*, author:author_id(name, role)").in("ticket_id", ticketIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as any[] } as any),
      admin.from("attachments").select("id, entity_type, entity_id, file_name, file_size, mime_type, label, created_at, uploader:uploaded_by(name)").eq("uploaded_by", u.id).order("created_at", { ascending: false }),
    ]);

  const payments = (paymentsByBooking as any)?.data ?? [];
  const bookingDocs = (attachmentsByBooking as any)?.data ?? [];
  const comments = (ticketComments as any)?.data ?? [];
  const userDocs = (userAttachments as any)?.data ?? [];

  // Group payments + docs by booking id
  const paymentsMap = new Map<string, any[]>();
  for (const p of payments) {
    const sid = Array.isArray(p.submitter) ? p.submitter[0] ?? null : p.submitter ?? null;
    const rev = Array.isArray(p.reviewer) ? p.reviewer[0] ?? null : p.reviewer ?? null;
    const row = { ...p, submitter: sid, reviewer: rev };
    if (!paymentsMap.has(p.booking_id)) paymentsMap.set(p.booking_id, []);
    paymentsMap.get(p.booking_id)!.push(row);
  }
  const docsMap = new Map<string, any[]>();
  for (const d of bookingDocs) {
    const up = Array.isArray(d.uploader) ? d.uploader[0] ?? null : d.uploader ?? null;
    const row = { ...d, uploader: up };
    if (!docsMap.has(d.entity_id)) docsMap.set(d.entity_id, []);
    docsMap.get(d.entity_id)!.push(row);
  }
  const commentsMap = new Map<string, any[]>();
  for (const c of comments) {
    const au = Array.isArray(c.author) ? c.author[0] ?? null : c.author ?? null;
    const row = { ...c, author: au };
    if (!commentsMap.has(c.ticket_id)) commentsMap.set(c.ticket_id, []);
    commentsMap.get(c.ticket_id)!.push(row);
  }

  const safeBookings = (rawBookings ?? []).map((b: any) => ({
    ...b,
    customer: Array.isArray(b.customer) ? b.customer[0] ?? null : b.customer ?? null,
    payments: paymentsMap.get(b.id) ?? [],
    docs: docsMap.get(b.id) ?? [],
  }));

  const safeTickets = (rawTickets ?? []).map((t: any) => ({
    ...t,
    comments: commentsMap.get(t.id) ?? [],
    assignee: null as any,
  }));

  // Also resolve assignees for tickets that have one
  const assigneeIds = [...new Set((rawTickets ?? []).map((t: any) => t.assigned_to).filter(Boolean))];
  let assigneeMap = new Map<string, any>();
  if (assigneeIds.length) {
    const { data: assignees } = await admin.from("app_users").select("id, name").in("id", assigneeIds);
    for (const a of assignees ?? []) assigneeMap.set(a.id, a);
  }
  for (const t of safeTickets) {
    const raw = (rawTickets ?? []).find((r: any) => r.id === t.id);
    if (raw?.assigned_to) t.assignee = assigneeMap.get(raw.assigned_to) ?? null;
  }

  const safeUserDocs = (userDocs ?? []).map((a: any) => ({
    ...a,
    uploader: Array.isArray(a.uploader) ? a.uploader[0] ?? null : a.uploader ?? null,
  }));

  const docUrls: DocUrl[] = safeUserDocs.map((a: any) => ({
    id: a.id,
    file_name: a.file_name,
    file_size: a.file_size,
    mime_type: a.mime_type,
    label: a.label,
    entity_type: a.entity_type,
    entity_id: a.entity_id,
    created_at: a.created_at,
    uploader: a.uploader,
  }));

  return <UserDetailClient user={u as any} bookings={safeBookings as any} tickets={safeTickets as any} docUrls={docUrls} />;
}