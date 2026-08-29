"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { ArrowRight } from "lucide-react";

const ROLES = [
  { value: "SM", label: "Sales Manager" },
  { value: "CP", label: "Channel Partner" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "ADMIN", label: "Admin" },
  { value: "DIRECTOR", label: "Director" }
];

export default function RegisterForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", employee_id: "",
    requested_role: "SM", password: "", confirm: ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");

    setBusy(true);
    // Server route creates the auth user with service role, inserts profile, and notifies directors
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        employee_id: form.employee_id,
        requested_role: form.requested_role
      })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setBusy(false);
      return setError(j.error ?? "Registration failed.");
    }
    // Sign in so the user reaches the pending screen with a live session
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password
    });
    setBusy(false);
    if (signInErr) return setError(signInErr.message);
    router.replace("/pending");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Rohit Menon" />
        </div>
        <div>
          <label className="label">Work email</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="rohit@aurum.com" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+91 98450 00000" />
        </div>
        <div>
          <label className="label">Employee / Partner ID</label>
          <input className="input" value={form.employee_id} onChange={(e) => update("employee_id", e.target.value)} placeholder="AUR-SM-104" />
        </div>
        <div className="col-span-2">
          <label className="label">Requested role</label>
          <select className="input" value={form.requested_role} onChange={(e) => update("requested_role", e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input className="input" type="password" required minLength={8} value={form.confirm} onChange={(e) => update("confirm", e.target.value)} placeholder="••••••••" />
        </div>
        {/*
          The ID-proof upload was removed here. It never persisted anything,
          and it cannot work on this page: registration is pre-auth, so there
          is no user id to key the storage path against (Storage RLS requires
          `<user-id>/...`). Supporting it needs a deferred upload after sign-in
          plus a 'user' entity type on attachments — ask if you want that.
        */}
      </div>

      {error && <div className="border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}

      <button className="flex w-full items-center justify-center gap-2 bg-[#ec3013] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#dd2b0f] disabled:opacity-50 cursor-pointer" disabled={busy}>
        {busy ? "Submitting request..." : <>Submit for Director approval <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  );
}
