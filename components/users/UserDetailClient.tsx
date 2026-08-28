"use client";
import { useState } from "react";
import Link from "next/link";
import {
  formatDate,
  formatDateTime,
  formatINR,
  initials,
  roleLabels,
  roleAccent,
  statusBadge,
} from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils/cn";
import {
  Building2,
  Wallet,
  FileText,
  Ticket,
  Paperclip,
  Copy,
  Check,
  Share2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  Shield,
  ExternalLink,
  ChevronDown,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Clock,
  FileCheck,
} from "lucide-react";

export type DocUrl = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  label: string | null;
  entity_type: string;
  entity_id: string;
  created_at: string;
  uploader: { name: string } | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  auth_provider: string;
  employee_id: string | null;
  requested_role: string | null;
  avatar_url: string | null;
  approved_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

type BookingRow = {
  id: string;
  booking_id: string;
  project_name: string;
  unit_number: string;
  property_details: string | null;
  total_property_value: number;
  total_amount_paid: number;
  remaining_balance: number;
  notes: string | null;
  status: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  rejection_reason: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  loan_sanctioned: boolean;
  loan_amount: number | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  payments: any[];
  docs: DocUrl[];
};

type TicketRow = {
  id: string;
  ticket_number: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  created_at: string;
  last_activity_at: string;
  assignee: { name: string } | null;
  comments: any[];
};

const TABS = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "bookings", label: "Bookings", icon: Building2 },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "documents", label: "Documents", icon: Paperclip },
] as const;

function fileIcon(mime: string) {
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("image")) return "🖼️";
  return "📎";
}
function fileSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UserDetailClient({
  user,
  bookings,
  tickets,
  docUrls,
}: {
  user: UserRow;
  bookings: BookingRow[];
  tickets: TicketRow[];
  docUrls: DocUrl[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [copied, setCopied] = useState(false);
  const [openBooking, setOpenBooking] = useState<string | null>(
    bookings[0]?.id ?? null,
  );
  const [docBusy, setDocBusy] = useState<string | null>(null);

  const accent = roleAccent[user.role] ?? roleAccent.SM;
  const totalValue = bookings.reduce(
    (s, b) => s + Number(b.total_property_value ?? 0),
    0,
  );
  const totalPaid = bookings.reduce(
    (s, b) => s + Number(b.total_amount_paid ?? 0),
    0,
  );
  const totalRemaining = totalValue - totalPaid;
  const allPayments = bookings.flatMap((b) => b.payments);

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  async function openDoc(id: string) {
    setDocBusy(id);
    try {
      const res = await fetch(`/api/documents/${id}`);
      const j = await res.json();
      if (j.signedUrl) window.open(j.signedUrl, "_blank");
    } finally {
      setDocBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      {/* Top bar — not inside AppShell, so show Aurum branding */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ec3013] text-sm font-extrabold tracking-tight text-white">
              A
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              Aurum
            </span>
            <span className="hidden text-xs font-medium text-slate-400 sm:inline">
              Real Estate
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Share link"}
            </button>
            <Link
              href="/login"
              className="hidden h-8 items-center rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 sm:inline-flex"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Aurum
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <div
                className={cn(
                  "grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white shadow-sm sm:h-20 sm:w-20 sm:text-xl",
                  accent.dot,
                )}
              >
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {user.name}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      accent.chip,
                    )}
                  >
                    {roleLabels[user.role] ?? user.role}
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      statusBadge[user.status] ?? "bg-slate-100 text-slate-700",
                    )}
                  >
                    {user.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {user.email}
                  </span>
                  {user.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {user.phone}
                    </span>
                  )}
                  {user.employee_id && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" /> {user.employee_id}
                    </span>
                  )}
                </p>
                <p className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Joined{" "}
                    {formatDate(user.created_at)}
                  </span>
                  {user.approved_at && (
                    <span>· Approved {formatDate(user.approved_at)}</span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" /> {user.auth_provider}
                  </span>
                  <span className="hidden sm:inline">
                    · ID {user.id.slice(0, 8)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                onClick={copyLink}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#ec3013] px-4 text-sm font-semibold text-white hover:bg-[#d92b12]"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Link copied" : "Copy profile link"}
              </button>
              <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500">
                Unique ID · {user.id.slice(0, 8)}…{user.id.slice(-4)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Bookings"
            value={String(bookings.length)}
            sub="submitted"
            icon={Building2}
          />
          <Stat
            label="Total value"
            value={formatINR(totalValue)}
            sub="portfolio"
            icon={TrendingUp}
            tone="slate"
          />
          <Stat
            label="Total paid"
            value={formatINR(totalPaid)}
            sub="verified"
            icon={Wallet}
            tone="emerald"
          />
          <Stat
            label="Remaining"
            value={formatINR(totalRemaining)}
            sub="pending"
            icon={Clock}
            tone="amber"
          />
          <Stat
            label="Payments"
            value={String(allPayments.length)}
            sub="entries"
            icon={FileCheck}
          />
          <Stat
            label="Tickets"
            value={String(tickets.length)}
            sub="raised"
            icon={Ticket}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-14 z-20 border-y border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const count =
                t.id === "bookings"
                  ? bookings.length
                  : t.id === "payments"
                    ? allPayments.length
                    : t.id === "tickets"
                      ? tickets.length
                      : t.id === "documents"
                        ? docUrls.length
                        : undefined;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                  {count !== undefined && (
                    <span
                      className={cn(
                        "ml-1 rounded-full px-1.5 py-0.5 text-xs",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-white text-slate-700",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Profile
                </h3>
                <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <Info label="Full name" value={user.name} />
                  <Info label="Email" value={user.email} />
                  <Info label="Phone" value={user.phone ?? "—"} />
                  <Info label="Employee ID" value={user.employee_id ?? "—"} />
                  <Info
                    label="Role"
                    value={roleLabels[user.role] ?? user.role}
                  />
                  <Info
                    label="Status"
                    value={user.status.replaceAll("_", " ")}
                  />
                  <Info label="Auth provider" value={user.auth_provider} />
                  <Info
                    label="Requested role"
                    value={
                      user.requested_role
                        ? (roleLabels[user.requested_role] ??
                          user.requested_role)
                        : "—"
                    }
                  />
                  <Info
                    label="Member since"
                    value={formatDate(user.created_at)}
                  />
                  <Info
                    label="Last login"
                    value={
                      user.last_login_at
                        ? formatDateTime(user.last_login_at)
                        : "—"
                    }
                  />
                </dl>
              </div>

              {bookings[0] && (
                <div className="card overflow-hidden p-0">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Latest booking
                    </h3>
                    <button
                      onClick={() => setTab("bookings")}
                      className="text-xs font-semibold text-[#ec3013] hover:underline"
                    >
                      View all →
                    </button>
                  </div>
                  <BookingCard
                    b={bookings[0]}
                    open={openBooking === bookings[0].id}
                    onToggle={() =>
                      setOpenBooking(
                        openBooking === bookings[0].id ? null : bookings[0].id,
                      )
                    }
                    onDoc={openDoc}
                    busy={docBusy}
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  At a glance
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Bookings</span>
                    <span className="font-semibold">{bookings.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payments</span>
                    <span className="font-semibold">{allPayments.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Documents</span>
                    <span className="font-semibold">{docUrls.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tickets</span>
                    <span className="font-semibold">{tickets.length}</span>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                  Share this page — anyone with the link can view it. No login
                  required. The URL contains the unique ID.
                </div>
              </div>

              {docUrls[0] && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Recent documents
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {docUrls.slice(0, 4).map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                      >
                        <span className="min-w-0 text-sm">
                          <span className="mr-1">{fileIcon(d.mime_type)}</span>
                          <span className="truncate font-medium">
                            {d.file_name}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">
                            {fileSize(d.file_size)}
                          </span>
                        </span>
                        <button
                          onClick={() => openDoc(d.id)}
                          disabled={docBusy === d.id}
                          className="shrink-0 text-xs font-semibold text-[#ec3013] hover:underline disabled:opacity-50"
                        >
                          {docBusy === d.id ? "…" : "Open"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setTab("documents")}
                    className="mt-3 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    View all documents →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "bookings" &&
          (bookings.length === 0 ? (
            <Empty
              title="No bookings yet"
              desc="This user hasn't submitted any bookings."
            />
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b.id} className="card overflow-hidden p-0">
                  <BookingCard
                    b={b}
                    open={openBooking === b.id}
                    onToggle={() =>
                      setOpenBooking(openBooking === b.id ? null : b.id)
                    }
                    onDoc={openDoc}
                    busy={docBusy}
                  />
                </div>
              ))}
            </div>
          ))}

        {tab === "payments" &&
          (allPayments.length === 0 ? (
            <Empty
              title="No payments"
              desc="Payments submitted by this user will appear here."
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Booking</th>
                      <th className="px-5 py-3 text-right font-medium">
                        Amount
                      </th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Mode</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments.map((p: any) => {
                      const bk = bookings.find((b) => b.id === p.booking_id);
                      return (
                        <tr key={p.id} className="border-t border-slate-200">
                          <td className="px-5 py-3">
                            <span className="font-medium">
                              {bk?.booking_id ?? "—"}
                            </span>
                            <span className="ml-2 text-xs text-slate-500">
                              {bk?.project_name ?? ""}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums font-medium">
                            {formatINR(p.amount)}
                          </td>
                          <td className="px-5 py-3">
                            {formatDate(p.payment_date)}
                          </td>
                          <td className="px-5 py-3">
                            {p.payment_mode?.replaceAll("_", " ")}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-5 py-3 text-slate-500">
                            {p.submitter?.name ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 sm:hidden">
                {allPayments.map((p: any) => {
                  const bk = bookings.find((b) => b.id === p.booking_id);
                  return (
                    <li key={p.id} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-medium">
                          {bk?.booking_id ?? "—"}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {bk?.project_name ?? ""} ·{" "}
                        {p.payment_mode?.replaceAll("_", " ")}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-slate-500">Amount</div>
                          <div className="font-semibold tabular-nums">
                            {formatINR(p.amount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Date</div>
                          <div>{formatDate(p.payment_date)}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ))}

        {tab === "tickets" &&
          (tickets.length === 0 ? (
            <Empty
              title="No tickets"
              desc="Support tickets raised by this user will appear here."
            />
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {t.ticket_number}
                        </span>
                        <StatusBadge status={t.status} />
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            statusBadge[t.priority] ?? "bg-slate-100",
                          )}
                        >
                          {t.priority}
                        </span>
                      </div>
                      <div className="mt-1 font-medium text-slate-900">
                        {t.subject}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {t.description}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {formatDate(t.created_at)}
                    </span>
                  </div>
                  {(t.comments?.length ?? 0) > 0 && (
                    <ol className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                      {t.comments.map((c: any) => (
                        <li key={c.id} className="flex gap-2 text-sm">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                          <span>
                            <span className="font-medium">
                              {c.author?.name ?? "—"}
                            </span>
                            <span className="text-slate-500">
                              {" "}
                              · {formatDateTime(c.created_at)}
                            </span>
                            <span className="mt-1 block text-slate-700">
                              {c.body}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          ))}

        {tab === "documents" &&
          (docUrls.length === 0 ? (
            <Empty
              title="No documents"
              desc="Files uploaded by this user will appear here."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {docUrls.map((d) => (
                <div key={d.id} className="card flex flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-lg">{fileIcon(d.mime_type)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {d.mime_type.split("/")[1] ?? d.mime_type}
                    </span>
                  </div>
                  <div className="mt-3 min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {d.file_name}
                    </div>
                    {d.label && (
                      <div className="truncate text-xs text-slate-500">
                        {d.label}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-slate-400">
                      {fileSize(d.file_size)} · {formatDate(d.created_at)}{" "}
                      {d.uploader?.name ? `· ${d.uploader.name}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => openDoc(d.id)}
                    disabled={docBusy === d.id}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {docBusy === d.id ? "Opening…" : "Open document"}
                  </button>
                </div>
              ))}
            </div>
          ))}
      </div>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        Aurum Real Estate Operations · Shareable profile — Unique ID {user.id} ·
        No login required
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: any;
  tone?: string;
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-slate-900";
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-base font-bold tabular-nums sm:text-lg",
          toneCls,
        )}
      >
        {value}
      </div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 break-words font-medium text-slate-900">
        {value}
      </div>
    </div>
  );
}
function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card grid place-items-center p-12 text-center">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{desc}</p>
    </div>
  );
}

function BookingCard({
  b,
  open,
  onToggle,
  onDoc,
  busy,
}: {
  b: BookingRow;
  open: boolean;
  onToggle: () => void;
  onDoc: (id: string) => void;
  busy: string | null;
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-5 text-left hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-900">
              {b.booking_id}
            </span>
            <StatusBadge status={b.status} />
            <span className="hidden text-xs text-slate-400 sm:inline">
              · {formatDate(b.created_at)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {b.project_name} · Unit {b.unit_number}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {b.customer?.name ?? "—"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm max-w-sm">
            <span>
              <span className="text-slate-500">Value</span>
              <span className="ml-1 font-semibold tabular-nums">
                {formatINR(b.total_property_value)}
              </span>
            </span>
            <span>
              <span className="text-slate-500">Paid</span>
              <span className="ml-1 font-semibold tabular-nums text-emerald-700">
                {formatINR(b.total_amount_paid)}
              </span>
            </span>
            <span>
              <span className="text-slate-500">Due</span>
              <span className="ml-1 font-semibold tabular-nums text-amber-700">
                {formatINR(b.remaining_balance)}
              </span>
            </span>
          </div>
        </div>
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-white transition",
            open && "rotate-180",
          )}
        >
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 bg-slate-50/50 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </h4>
              <div className="mt-2 space-y-1 text-sm">
                <div className="font-medium">{b.customer?.name ?? "—"}</div>
                <div className="text-slate-500">
                  {b.customer?.phone ?? "—"}{" "}
                  {b.customer?.email ? `· ${b.customer.email}` : ""}
                </div>
              </div>
            </div>
            <div className="card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Property
              </h4>
              <div className="mt-2 space-y-1 text-sm">
                <div>
                  {b.project_name} · Unit {b.unit_number}
                </div>
                {b.property_details && (
                  <div className="break-words text-slate-500">
                    {b.property_details}
                  </div>
                )}
                {b.notes && (
                  <div className="break-words text-slate-500">{b.notes}</div>
                )}
              </div>
            </div>
            <div className="card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Financial
              </h4>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Value</div>
                  <div className="font-semibold tabular-nums">
                    {formatINR(b.total_property_value)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Paid</div>
                  <div className="font-semibold tabular-nums text-emerald-700">
                    {formatINR(b.total_amount_paid)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Due</div>
                  <div className="font-semibold tabular-nums text-amber-700">
                    {formatINR(b.remaining_balance)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {(b.bank_name || b.bank_account_number || b.loan_sanctioned) && (
            <div className="card mt-4 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bank details
              </h4>
              <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Bank" value={b.bank_name ?? "—"} />
                <Info label="Branch" value={b.bank_branch ?? "—"} />
                <Info
                  label="Account holder"
                  value={b.bank_account_holder ?? "—"}
                />
                <Info label="Account" value={b.bank_account_number ?? "—"} />
                <Info label="IFSC" value={b.bank_ifsc ?? "—"} />
                <Info
                  label="Home loan"
                  value={
                    b.loan_sanctioned
                      ? `Sanctioned${b.loan_amount ? " · " + formatINR(b.loan_amount) : ""}`
                      : "Not sanctioned"
                  }
                />
              </div>
            </div>
          )}

          <div className="card mt-4 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h4 className="text-sm font-semibold">Payments</h4>
              <span className="text-xs text-slate-500">
                {b.payments.length} entries
              </span>
            </div>
            {b.payments.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                No payments recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-4 py-2 text-right font-medium">
                        Amount
                      </th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Mode</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.payments.map((p: any, i: number) => (
                      <tr key={p.id} className="border-t border-slate-200">
                        <td className="px-4 py-2">#{b.payments.length - i}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          {formatINR(p.amount)}
                        </td>
                        <td className="px-4 py-2">
                          {formatDate(p.payment_date)}
                        </td>
                        <td className="px-4 py-2">
                          {p.payment_mode?.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {b.docs.length > 0 && (
            <div className="card mt-4 p-4">
              <h4 className="text-sm font-semibold">Documents</h4>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {b.docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm">
                      <span className="mr-1">{fileIcon(d.mime_type)}</span>
                      {d.file_name}
                    </span>
                    <button
                      onClick={() => onDoc(d.id)}
                      disabled={busy === d.id}
                      className="shrink-0 text-xs font-semibold text-[#ec3013] hover:underline disabled:opacity-50"
                    >
                      {busy === d.id ? "…" : "Open"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {b.rejection_reason && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span className="font-semibold">Rejection reason:</span>{" "}
              {b.rejection_reason}
            </div>
          )}
        </div>
      )}
    </>
  );
}
