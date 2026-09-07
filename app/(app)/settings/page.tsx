import { requireUser } from "@/lib/auth/session";
import PageHeader from "@/components/ui/PageHeader";
import SettingsClient from "@/components/settings/SettingsClient";
import PasswordUpdateCard from "@/components/settings/PasswordUpdateCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const isEmailUser = user.auth_provider !== "GOOGLE";
  return (
    <>
      <PageHeader title="Settings" description="Manage notification preferences and account security." />
      {isEmailUser ? (
        <div className="grid gap-6 lg:grid-cols-3 items-start max-w-6xl">
          <div className="lg:col-span-2 card p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Notifications</h3>
            <SettingsClient />
          </div>
        <div className="lg:col-span-2 sticky top-6">
          <PasswordUpdateCard authProvider={user.auth_provider as string | null} />
        </div>
        </div>
      ) : (
        <div className="max-w-3xl card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Notifications</h3>
          <SettingsClient />
        </div>
      )}
    </>
  );
}
