"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { roleLabels, roleAccent, formatDate } from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils/cn";
import { User, Mail, Phone, Shield, Building, CheckCircle, Save } from "lucide-react";

export default function ProfileClient({ profile }: { profile: any }) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accent = roleAccent[profile.role] ?? roleAccent.SM;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const { error: updErr } = await supabase
      .from("app_users")
      .update({ name: name.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);

    setSaving(false);
    if (updErr) {
      setError(updErr.message);
    } else {
      setMessage("Profile updated successfully!");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Profile Overview Card */}
      <div className="card p-6 sm:p-8 bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={cn("grid h-16 w-16 place-items-center rounded-2xl text-white font-heading font-extrabold text-xl shadow-md", accent.dot)}>
              {profile.name ? profile.name.split(" ").slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("") : "AU"}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900">{profile.name}</h2>
                <StatusBadge status={profile.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{profile.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={cn("badge border", accent.chip)}>
                  {roleLabels[profile.role]}
                </span>
                <span className="text-[11px] text-slate-400">
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Account Details</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full name</label>
              <div className="relative">
                <input
                  className="input pl-10"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="label">Work email</label>
              <div className="relative">
                <input
                  className="input pl-10 bg-slate-50 text-slate-500 cursor-not-allowed"
                  disabled
                  value={profile.email}
                />
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="label">Phone number</label>
              <div className="relative">
                <input
                  className="input pl-10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98450 00000"
                />
                <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="label">Employee / Partner ID</label>
              <div className="relative">
                <input
                  className="input pl-10 bg-slate-50 text-slate-500 cursor-not-allowed"
                  disabled
                  value={profile.employee_id || "Not assigned"}
                />
                <Building className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <Save className="h-4 w-4" />
              <span>{saving ? "Saving changes..." : "Save changes"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Permissions & Security Summary */}
      <div className="card p-6 bg-white border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[#ec3013]" />
          <span>Role & Security Permissions</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-semibold text-slate-800">Authentication</div>
            <div className="text-slate-500 mt-1">Provider: {profile.auth_provider ?? "Email / Google"}</div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-semibold text-slate-800">Assigned Role</div>
            <div className="text-slate-500 mt-1">{roleLabels[profile.role]}</div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-semibold text-slate-800">Account Access</div>
            <div className="text-emerald-700 font-medium mt-1">Verified & Active</div>
          </div>
        </div>
      </div>
    </div>
  );
}
