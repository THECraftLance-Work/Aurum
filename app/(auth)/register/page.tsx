import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="w-full">
      {/* Top Mode Switcher Tabs */}
      <div className="grid grid-cols-2 border border-[var(--color-divider)] mb-8 bg-[var(--color-surface)]">
        <Link
          href="/login"
          className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors text-left flex items-center justify-between"
        >
          <span className="inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Sign in</span>
        </Link>
        <button
          type="button"
          className="py-3 px-4 text-xs font-semibold uppercase tracking-wider bg-[var(--color-bg)] text-[var(--color-text)] border-b-2 border-[#ec3013] border-l border-[var(--color-divider)] text-left"
        >
          Request access
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-heading font-extrabold tracking-tight text-[var(--color-text)]">
          Request platform access
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Every registration is reviewed by an Aurum Director before access is provisioned.
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
