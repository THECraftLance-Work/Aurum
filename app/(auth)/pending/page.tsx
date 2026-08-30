import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import PendingClient from "./PendingClient";
import { roleLabels } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/format";

export default async function PendingPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users").select("*").eq("id", user.id).maybeSingle();

  if (!profile) redirect("/login");
  if (profile.status === "APPROVED") redirect("/dashboard");

  return (
    <div className="w-full">
      <div className="h-1 bg-[#ec3013] mb-6" />

      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#ec3013] mb-1">
        {profile.status === "REJECTED" ? "Account Status: Rejected" : "Account Status: Pending Approval"}
      </div>

      <h1 className="text-2xl font-heading font-extrabold text-[var(--color-text)] tracking-tight">
        {profile.status === "REJECTED" ? "Access request declined" : "Awaiting Director review"}
      </h1>

      <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
        {profile.status === "REJECTED"
          ? "Your access request was declined. Please contact your platform administrator."
          : "Access is provisioned after an Aurum Director approves your requested role. This page updates in real-time."}
      </p>

      <div className="mt-6 border-t-2 border-[var(--color-divider)] pt-2 text-sm">
        <Row label="Name" value={profile.name} />
        <Row label="Work email" value={profile.email} />
        <Row label="Requested role" value={roleLabels[profile.requested_role ?? profile.role]} />
        <Row
          label="Status"
          value={
            <span
              className={`badge ${
                profile.status === "REJECTED"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-900 border border-amber-300"
              }`}
            >
              {profile.status}
            </span>
          }
        />
        <Row label="Submitted at" value={formatDateTime(profile.created_at)} />
      </div>

      <PendingClient />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-divider)] py-2.5 text-xs">
      <div className="text-neutral-500 font-medium">{label}</div>
      <div className="font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}
