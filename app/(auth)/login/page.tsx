import { redirect } from "next/navigation";
import { getAuthUserWithProfile } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const { profile, revoked } = await getAuthUserWithProfile();
  if (revoked) {
    // Layout already signs out and redirects with ?revoked=1; allow page to render with error
  } else if (profile) {
    if (profile.status === "APPROVED") redirect("/dashboard");
    redirect("/pending");
  }
  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-heading font-extrabold tracking-tight text-[var(--color-text)]">
          Sign in to Aurum
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Internal operations platform. Sign in with your Google Workspace account.
        </p>
      </div>

      <LoginForm />
    </div>
  );
}
