import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="w-full">
      {/* Top Mode Switcher Tabs */}
      <div className="grid grid-cols-2 border border-[var(--color-divider)] mb-8 bg-[var(--color-surface)]">
        <button
          type="button"
          className="py-3 px-4 text-xs font-semibold uppercase tracking-wider bg-[var(--color-bg)] text-[var(--color-text)] border-b-2 border-[#ec3013] text-left"
        >
          Sign in
        </button>
        <Link
          href="/register"
          className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors border-l border-[var(--color-divider)] text-left flex items-center justify-between"
        >
          <span>Request access</span>
          <ArrowRight className="h-3.5 w-3.5 opacity-60" />
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-heading font-extrabold tracking-tight text-[var(--color-text)]">
          Sign in to Aurum
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Internal operations platform. Use Google Workspace or your work credentials.
        </p>
      </div>

      <LoginForm />
    </div>
  );
}

