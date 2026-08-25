export function formatINR(n: number | string | null | undefined) {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(num);
}

export function formatDate(d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...opts
  }).format(date);
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export const roleLabels: Record<string, string> = {
  SM: "Sales Manager",
  CP: "Channel Partner",
  ACCOUNTANT: "Accountant",
  ADMIN: "Admin",
  DIRECTOR: "Director"
};

export const roleAccent: Record<string, { chip: string; ring: string; dot: string }> = {
  SM:         { chip: "bg-blue-50 text-blue-700 border-blue-200",       ring: "ring-blue-500",    dot: "bg-blue-500" },
  CP:         { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", ring: "ring-emerald-500", dot: "bg-emerald-500" },
  ACCOUNTANT: { chip: "bg-amber-50 text-amber-700 border-amber-200",    ring: "ring-amber-500",   dot: "bg-amber-500" },
  ADMIN:      { chip: "bg-slate-100 text-slate-700 border-slate-300",   ring: "ring-slate-500",   dot: "bg-slate-500" },
  DIRECTOR:   { chip: "bg-violet-50 text-violet-700 border-violet-200", ring: "ring-violet-500",  dot: "bg-violet-500" }
};

export const statusBadge: Record<string, string> = {
  DRAFT:            "bg-slate-100 text-slate-700",
  SUBMITTED:        "bg-blue-50 text-blue-700",
  UNDER_REVIEW:     "bg-amber-50 text-amber-700",
  APPROVED:         "bg-emerald-50 text-emerald-700",
  REJECTED:         "bg-rose-50 text-rose-700",
  UPDATED:          "bg-indigo-50 text-indigo-700",
  ARCHIVED:         "bg-slate-100 text-slate-500",
  PENDING:          "bg-amber-50 text-amber-700",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  SUSPENDED:        "bg-rose-50 text-rose-700",
  DISABLED:         "bg-slate-100 text-slate-500",

  // Ticket statuses — StatusBadge renders these unchanged.
  OPEN:             "bg-blue-50 text-blue-700",
  IN_PROGRESS:      "bg-amber-50 text-amber-700",
  WAITING_ON_USER:  "bg-indigo-50 text-indigo-700",
  RESOLVED:         "bg-emerald-50 text-emerald-700",
  CLOSED:           "bg-slate-100 text-slate-500"
};

export const priorityBadge: Record<string, string> = {
  LOW:    "bg-slate-100 text-slate-600",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH:   "bg-amber-50 text-amber-700",
  URGENT: "bg-rose-50 text-rose-700"
};

export const ticketCategoryLabels: Record<string, string> = {
  BUG:             "Something broken",
  ACCESS:          "Access",
  DATA_CORRECTION: "Data correction",
  BOOKING_ISSUE:   "Booking issue",
  PAYMENT_ISSUE:   "Payment issue",
  FEATURE_REQUEST: "Feature request",
  OTHER:           "Other",
  // Legacy value from the earlier draft schema. Not offered for new tickets
  // (BUG covers it), but existing rows still need a readable label.
  TECHNICAL:       "Technical"
};
