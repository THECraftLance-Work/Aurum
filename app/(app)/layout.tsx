import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  /**
   * Count of payments awaiting verification, surfaced as a pulsing badge on the
   * sidebar's Verification Queue entry. Only reviewers can act on it, so only
   * they pay for the query.
   */
  let pendingVerification = 0;
  if (["ACCOUNTANT", "ADMIN", "DIRECTOR"].includes(user.role)) {
    const supabase = await createSupabaseServer();
    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("status", ["PENDING", "UNDER_REVIEW"]);
    pendingVerification = count ?? 0;
  }

  return (
    <AppShell user={user} pendingVerification={pendingVerification}>
      {children}
    </AppShell>
  );
}
