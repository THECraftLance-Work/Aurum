"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, RefreshCw } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { SessionUser } from "@/lib/auth/session";

export default function ProjectSelectionShell({
  user,
  children
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const { toast } = useToast();
  const [reloading, setReloading] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function reload() {
    if (reloading) return;
    setReloading(true);
    toast({
      title: "Reloading…",
      description: "Refreshing available projects",
      tone: "info",
      duration: 2000,
    });
    router.refresh();
    window.setTimeout(() => {
      setReloading(false);
      toast({
        title: "Reloaded",
        description: "Project selection is up to date",
        tone: "success",
      });
    }, 800);
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-8xl items-center justify-end gap-2 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={reload}
            disabled={reloading}
            className="btn-secondary h-10"
            aria-label="Reload project selection"
            title="Reload"
          >
            <RefreshCw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            className="btn-secondary h-10"
            title="Sign out"
          >
            <LogOut className="h-4 w-4 text-slate-600" />
            <span>Sign out</span>
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <ConfirmDialog
        open={confirmSignOut}
        busy={signingOut}
        tone="primary"
        title="Sign out of Sree Varaaha?"
        message={<>You are signed in as <span className="font-medium">{user.name}</span>.</>}
        confirmLabel="Sign out"
        onConfirm={signOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}
