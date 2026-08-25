"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import PremiumLoader from "@/components/ui/PremiumLoader";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoadingMessage("Authenticating session credentials...");
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setLoadingMessage(null);
      return setError(error.message);
    }
    setLoadingMessage("Entering Aurum Platform...");
    router.replace("/dashboard");
    router.refresh();
  }

  async function google() {
    setBusy(true);
    setLoadingMessage("Connecting to Google Workspace...");
    setError(null);
    const redirect = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect }
    });
    if (error) {
      setBusy(false);
      setLoadingMessage(null);
      setError(error.message);
    }
  }

  return (
    <>
      {busy && loadingMessage && (
        <PremiumLoader
          message={loadingMessage}
          submessage="Establishing secure ledger connection"
        />
      )}

      <form onSubmit={submit} className="space-y-4">
        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-[var(--color-divider)] bg-[var(--color-surface)] hover:bg-[#dfdddd] text-sm font-semibold text-[var(--color-text)] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-divider)]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[var(--color-bg)] px-3 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
            or sign in with email
          </span>
        </div>
      </div>

      <div>
        <label className="label">Work email</label>
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="priya.nair@aurum.com"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label">Password</label>
        </div>
        <input
          className="input"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
        />
      </div>

      {error && (
        <div className="border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 px-4 bg-[#ec3013] hover:bg-[#dd2b0f] text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
      >
        {busy ? "Signing in..." : "Enter platform →"}
      </button>
    </form>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

