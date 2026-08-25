"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="card max-w-md w-full p-8 text-center bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
          <p className="text-xs text-slate-500 mt-1">
            An unexpected error occurred while processing this request.
          </p>
        </div>

        {error.message && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs font-mono text-slate-700 break-words">
            {error.message}
          </div>
        )}

        <div className="pt-2 flex items-center justify-center gap-3">
          <button onClick={() => reset()} className="btn-primary flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            <span>Try again</span>
          </button>
          <Link href="/dashboard" className="btn-secondary flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
