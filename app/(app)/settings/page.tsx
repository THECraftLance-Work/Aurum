import { requireUser } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import { roleLabels } from "@/lib/utils/format";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Profile & settings" description="Your account details and notification preferences." />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Profile</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Name" value={user.name} />
            <Info label="Email" value={user.email} />
            <Info label="Role" value={roleLabels[user.role]} />
            <Info label="Status" value={user.status} />
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Notifications</h3>
          <SettingsClient />
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-slate-900">{value}</div>
    </div>
  );
}
