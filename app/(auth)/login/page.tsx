import LoginForm from "./LoginForm";

export default function LoginPage() {
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
