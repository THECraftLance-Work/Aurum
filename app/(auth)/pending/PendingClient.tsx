"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function PendingClient() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) return;
      channel = supabase
        .channel(`user-status-${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "app_users", filter: `id=eq.${user.id}` },
          (payload) => {
            const status = (payload.new as any).status;
            if (status === "APPROVED") router.replace("/dashboard");
            else router.refresh();
          }
        )
        .subscribe();
    })();

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  const [checking, setChecking] = useState(false);

  async function refreshCheck() {
    setChecking(true);
    router.refresh();
    setTimeout(() => setChecking(false), 800);
  }
  async function logout() {
    setChecking(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="mt-6 flex items-center justify-end gap-2">
      <button onClick={refreshCheck} disabled={checking} className="btn-secondary text-xs">
        {checking ? "Checking live status..." : "Check status"}
      </button>
      <button onClick={logout} disabled={checking} className="btn-primary text-xs">
        Sign out
      </button>
    </div>
  );
}
