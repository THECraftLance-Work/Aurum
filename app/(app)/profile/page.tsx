import { requireUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import ProfileClient from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const supabase = createSupabaseServer();

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", sessionUser.id)
    .single();

  return (
    <>
      <PageHeader
        title="My Profile"
        description="Manage your Aurum account settings, contact details, and role permissions."
      />
      <ProfileClient profile={profile ?? sessionUser} />
    </>
  );
}
