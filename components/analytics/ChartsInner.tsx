"use client";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, Cell
} from "recharts";
import { formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const ACCENT = "#ec3013";
const EMERALD = "#059669";
const AMBER = "#d97706";
const BLUE = "#0284c7";
const VIOLET = "#7c3aed";
const SLATE = "#64748b";

const STATUS_COLORS: Record<string, string> = {
  APPROVED: EMERALD,
  SUBMITTED: BLUE,
  UNDER_REVIEW: AMBER,
  UPDATED: VIOLET,
  REJECTED: ACCENT,
  DRAFT: SLATE,
  ARCHIVED: "#94a3b8"
};

/** Compact axis labels — ₹1.25Cr rather than 12500000. */
function compactINR(n: number) {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`;
  return `₹${v}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 shadow-pop">
      <div className="mb-1 text-xs font-semibold text-slate-900">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-slate-500">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-slate-900">
            {p.dataKey === "bookings" ? p.value : formatINR(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, subtitle, children, delay = 0 }: {
  title: string; subtitle?: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <div className="card card-hover min-w-0 animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function ChartsInner({ bookings, payments }: { bookings: any[]; payments: any[] }) {
  const byMonth = useMemo(() => {
    const m: Record<string, { month: string; bookings: number; collection: number; value: number }> = {};
    const touch = (k: string) => (m[k] ??= { month: k, bookings: 0, collection: 0, value: 0 });

    bookings.forEach((b) => {
      const d = new Date(b.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = touch(k);
      row.bookings += 1;
      row.value += Number(b.total_property_value ?? 0);
    });
    payments.forEach((p) => {
      if (p.status !== "APPROVED") return;
      const d = new Date(p.payment_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      touch(k).collection += Number(p.amount ?? 0);
    });

    return Object.values(m)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({ ...r, label: monthLabel(r.month) }));
  }, [bookings, payments]);

  const statusDist = useMemo(() => {
    const c: Record<string, number> = {};
    bookings.forEach((b) => { c[b.status] = (c[b.status] ?? 0) + 1; });
    const total = bookings.length || 1;
    return Object.entries(c)
      .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [bookings]);

  const byProject = useMemo(() => {
    const c: Record<string, { name: string; count: number; value: number; collected: number }> = {};
    bookings.forEach((b) => {
      const k = b.project_name ?? "—";
      c[k] ??= { name: k, count: 0, value: 0, collected: 0 };
      c[k].count += 1;
      c[k].value += Number(b.total_property_value ?? 0);
      c[k].collected += Number(b.total_amount_paid ?? 0);
    });
    return Object.values(c).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [bookings]);

  const byMode = useMemo(() => {
    const c: Record<string, number> = {};
    payments.filter((p) => p.status === "APPROVED").forEach((p) => {
      const k = (p.payment_mode ?? "OTHER").replaceAll("_", " ");
      c[k] = (c[k] ?? 0) + Number(p.amount ?? 0);
    });
    return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [payments]);

  if (bookings.length === 0) {
    return (
      <div className="card grid place-items-center p-12 text-center">
        <div className="text-sm font-semibold text-slate-900">No data in this range</div>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Widen the date range, or create a booking to start seeing trends here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <Panel title="Collection over time" subtitle="Approved payments received per month" delay={0}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={byMonth} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gCollection" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={EMERALD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} tickFormatter={compactINR} width={64} />
              <Tooltip content={<CurrencyTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />
              <Area
                type="monotone" dataKey="collection" name="Collected"
                stroke={EMERALD} strokeWidth={2} fill="url(#gCollection)"
                animationBegin={0} animationDuration={900} animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Bookings per month" subtitle="Volume of new bookings created" delay={80}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
              <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
              <Bar
                dataKey="bookings" name="Bookings" fill={BLUE} radius={[6, 6, 0, 0]} maxBarSize={44}
                animationBegin={120} animationDuration={800} animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/*
        Replaces the old donut. A stacked proportion bar reads status mix far
        faster than a pie, and the legend carries the exact counts.
      */}
      <Panel title="Verification status" subtitle={`${bookings.length} bookings in this range`} delay={160}>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {statusDist.map((s, i) => (
            <div
              key={s.name}
              className="h-full origin-left animate-bar-grow transition-all duration-200 hover:brightness-110"
              style={{
                width: `${s.pct}%`,
                background: STATUS_COLORS[s.name] ?? SLATE,
                animationDelay: `${200 + i * 90}ms`
              }}
              title={`${s.name.replaceAll("_", " ")}: ${s.value}`}
            />
          ))}
        </div>
        <ul className="mt-5 space-y-2.5">
          {statusDist.map((s) => (
            <li key={s.name} className="flex items-center gap-2.5 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLORS[s.name] ?? SLATE }} />
              <span className="min-w-0 truncate text-slate-600">{s.name.replaceAll("_", " ")}</span>
              <span className="ml-auto shrink-0 tabular-nums font-semibold text-slate-900">{s.value}</span>
              <span className="w-12 shrink-0 text-right tabular-nums text-xs text-slate-400">{s.pct.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Project performance" subtitle="Pipeline value vs amount collected" delay={240}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={byProject} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} tickFormatter={compactINR} />
              <YAxis
                type="category" dataKey="name" width={110}
                tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false}
                tickFormatter={(v: string) => (v.length > 15 ? v.slice(0, 14) + "…" : v)}
              />
              <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar dataKey="value" name="Total value" fill={VIOLET} radius={[0, 6, 6, 0]} maxBarSize={14}
                   animationBegin={280} animationDuration={800} animationEasing="ease-out" />
              <Bar dataKey="collected" name="Collected" fill={EMERALD} radius={[0, 6, 6, 0]} maxBarSize={14}
                   animationBegin={380} animationDuration={800} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {byMode.length > 0 && (
        <Panel title="Collection by payment mode" subtitle="Approved payments only" delay={320}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMode} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} tickFormatter={compactINR} width={64} />
                <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                <Bar dataKey="value" name="Collected" radius={[6, 6, 0, 0]} maxBarSize={54}
                     animationBegin={360} animationDuration={800} animationEasing="ease-out">
                  {byMode.map((_, i) => (
                    <Cell key={i} fill={[BLUE, EMERALD, AMBER, VIOLET, ACCENT, SLATE][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <Panel title="Pipeline value added" subtitle="Total booking value created per month" delay={400}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={byMonth} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={VIOLET} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={VIOLET} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: SLATE }} tickLine={false} axisLine={false} tickFormatter={compactINR} width={64} />
              <Tooltip content={<CurrencyTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />
              <Area type="monotone" dataKey="value" name="Pipeline value"
                    stroke={VIOLET} strokeWidth={2} fill="url(#gValue)"
                    animationBegin={440} animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
