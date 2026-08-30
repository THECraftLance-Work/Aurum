import { requireUser } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Settings" description="Manage notification preferences for this browser." />
      <div className="max-w-3xl">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Notifications</h3>
          <SettingsClient />
        </div>
      </div>
    </>
  );
}
