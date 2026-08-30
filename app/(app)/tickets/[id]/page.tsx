import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import TicketThread from "@/components/tickets/TicketThread";
import TicketActions from "@/components/tickets/TicketActions";
import { formatDateTime, priorityBadge, ticketCategoryLabels, roleLabels } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  // RLS returns nothing if this user isn't the raiser, assignee, or staff.
  const { data: t } = await supabase
    .from("tickets")
    .select("*, raiser:raised_by(name, role, email), assignee:assigned_to(name), resolver:resolved_by(name)")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const isStaff = ["ADMIN", "DIRECTOR"].includes(user.role);

  const [{ data: comments }, { data: staff }] = await Promise.all([
    supabase
      .from("ticket_comments")
      .select("*, author:author_id(name, role)")
      .eq("ticket_id", t.id)
      .order("created_at", { ascending: true }),
    isStaff
      ? supabase.from("app_users").select("id, name, role").in("role", ["ADMIN", "DIRECTOR"]).eq("status", "APPROVED")
      : Promise.resolve({ data: [] as any[] })
  ]);

  return (
    <>
      <PageHeader
        title={t.ticket_number}
        description={t.subject}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/tickets" className="btn-secondary h-10">Back</Link>
            <StatusBadge status={t.status} />
          </div>
        }
      />

      <div className="h-[calc(100vh-175px)] overflow-y-auto overscroll-contain pr-1">
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Description</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{t.description}</p>
          </div>

          <TicketThread
            ticketId={t.id}
            comments={comments ?? []}
            currentUserId={user.id}
            isStaff={isStaff}
          />
        </div>

        <aside className="min-w-0 space-y-4 self-start xl:sticky xl:top-24">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Details</h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="Raised by" value={`${t.raiser?.name ?? "—"} (${roleLabels[t.raiser?.role] ?? ""})`} />
              <Row label="Category" value={ticketCategoryLabels[t.category] ?? t.category} />
              <Row
                label="Priority"
                value={<span className={cn("badge", priorityBadge[t.priority])}>{t.priority}</span>}
              />
              <Row label="Assigned to" value={t.assignee?.name ?? "Unassigned"} />
              <Row label="Raised" value={formatDateTime(t.created_at)} />
              {t.page_path && (
                <Row label="From page" value={<span className="break-all font-mono text-xs">{t.page_path}</span>} />
              )}
              {t.related_entity_type === "booking" && t.related_entity_id && (
                <Row
                  label="Booking"
                  value={<Link href={`/bookings/${t.related_entity_id}`} className="text-accent hover:underline">Open booking</Link>}
                />
              )}
            </dl>

            {t.resolution_note && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <div className="text-xs font-semibold text-emerald-800">Resolution</div>
                <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-emerald-900">{t.resolution_note}</div>
                {t.resolver?.name && (
                  <div className="mt-1 text-[11px] text-emerald-700">— {t.resolver.name}, {formatDateTime(t.resolved_at)}</div>
                )}
              </div>
            )}
          </div>

          {isStaff && (
            <TicketActions
              ticketId={t.id}
              status={t.status}
              priority={t.priority}
              assignedTo={t.assigned_to}
              staff={staff ?? []}
            />
          )}
        </aside>
      </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
