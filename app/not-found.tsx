import Link from "next/link";
import { Search, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="card max-w-md w-full p-10 text-center bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-400">
          <Search className="h-7 w-7" />
        </div>
        <div>
          <div className="text-5xl font-extrabold text-slate-900">404</div>
          <h2 className="mt-2 text-lg font-bold text-slate-900">Page not found</h2>
          <p className="text-sm text-slate-500 mt-1">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/dashboard" className="btn-primary flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
