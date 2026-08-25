/**
 * Aurum UI States Library - 10 core states
 */
"use client";
import { cn } from "@/lib/utils/cn";
import {
  PackageOpen, AlertTriangle, CheckCircle2, WifiOff, Lock,
  Search, Clock, ShieldOff, RefreshCw, HelpCircle, Loader2
} from "lucide-react";
import Link from "next/link";

// 1. EMPTY STATE
export function EmptyState({ title = "Nothing here yet", description, icon, action }: {
  title?: string; description?: string; icon?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 mb-4">
        {icon ?? <PackageOpen className="h-6 w-6" />}
      </div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {description && <p className="mt-1.5 max-w-xs text-sm text-slate-500 leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// 2. SKELETON ROW
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className="h-4 rounded-lg bg-slate-200 animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// 2b. SKELETON CARD
export function SkeletonCard() {
  return (
    <div className="card space-y-3 overflow-hidden">
      <div className="h-3 w-2/5 rounded-lg bg-slate-200 animate-pulse" />
      <div className="h-7 w-3/5 rounded-lg bg-slate-200 animate-pulse" />
      <div className="h-2.5 w-1/3 rounded-lg bg-slate-100 animate-pulse" />
    </div>
  );
}

// 2c. SKELETON GRID
export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// 2d. INLINE LOADER
export function InlineLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500 text-sm">
      <Loader2 className="h-5 w-5 animate-spin text-[#ec3013]" />
      <span>{label}</span>
    </div>
  );
}

// 3. ERROR STATE
export function ErrorState({ title = "Something went wrong", message, onRetry }: {
  title?: string; message?: string; onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {message && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-5 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> <span>Try again</span>
        </button>
      )}
    </div>
  );
}

// 4. SUCCESS BANNER
export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      <span className="font-medium">{message}</span>
    </div>
  );
}

// 5. WARNING BANNER
export function WarningBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      <span className="font-medium">{message}</span>
    </div>
  );
}

// 5b. ERROR BANNER (inline)
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />
      <span className="font-medium">{message}</span>
    </div>
  );
}

// 5c. INFO BANNER
export function InfoBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <HelpCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// 6. OFFLINE STATE
export function OfflineState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 border border-slate-700 text-amber-400 mb-4">
        <WifiOff className="h-6 w-6 animate-pulse" />
      </div>
      <div className="text-sm font-semibold text-slate-900">You are offline</div>
      <p className="mt-1.5 max-w-xs text-sm text-slate-500">Check your internet connection. Aurum will reconnect automatically.</p>
    </div>
  );
}

// 7. FORBIDDEN STATE
export function ForbiddenState({ description }: { description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 border border-violet-200 text-violet-600 mb-4">
        <Lock className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-slate-900">Access restricted</div>
      <p className="mt-1.5 max-w-xs text-sm text-slate-500">
        {description ?? "You don't have permission to view this section. Contact your Director to request access."}
      </p>
      <Link href="/dashboard" className="btn-secondary mt-5">Return to Dashboard</Link>
    </div>
  );
}

// 8. NOT FOUND STATE
export function NotFoundState({ resource = "Record" }: { resource?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 mb-4">
        <Search className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-slate-900">{resource} not found</div>
      <p className="mt-1.5 max-w-xs text-sm text-slate-500">The {resource.toLowerCase()} you are looking for does not exist or may have been removed.</p>
      <Link href="/dashboard" className="btn-secondary mt-5">Back to Dashboard</Link>
    </div>
  );
}

// 9. SUSPENDED / REVOKED STATE
export function SuspendedState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mb-4">
        <ShieldOff className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-slate-900">Account suspended</div>
      <p className="mt-1.5 max-w-xs text-sm text-slate-500">Your account access has been revoked by a Director. Contact your administrator.</p>
    </div>
  );
}

// 10. PENDING REVIEW STATE
export function PendingReviewState({ description }: { description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-4">
        <Clock className="h-6 w-6 animate-pulse" />
      </div>
      <div className="text-sm font-semibold text-slate-900">Pending review</div>
      <p className="mt-1.5 max-w-xs text-sm text-slate-500">
        {description ?? "This record is currently under review and will be updated once a decision is made."}
      </p>
    </div>
  );
}
