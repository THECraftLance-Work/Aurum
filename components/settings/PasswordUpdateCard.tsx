"use client";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function PasswordUpdateCard({ authProvider }: { authProvider?: string | null }) {
  const supabase = createSupabaseBrowser();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isGoogle = authProvider === "GOOGLE";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (newPw.length < 8) return setErr("Password must be at least 8 characters.");
    if (newPw !== confirmPw) return setErr("Passwords do not match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) setErr(error.message);
    else { setMsg("Password updated successfully!"); setNewPw(""); setConfirmPw(""); }
  }

  if (isGoogle) return null;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Lock className="h-4 w-4 text-[#ec3013]" /> Update password</h3>
      <p className="mt-1 text-xs text-slate-500">Change your email account password. 8+ characters.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label className="label">New password</label>
          <div className="relative">
            <input className="input pr-10" type={showPw ? "text" : "password"} required minLength={8} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="8+ characters" />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100 text-slate-500" tabIndex={-1}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </div>
        <div>
          <label className="label">Confirm password</label>
          <div className="relative">
            <input className="input pr-10" type={showPw ? "text" : "password"} required minLength={8} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat password" />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100 text-slate-500" tabIndex={-1}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </div>
        {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2"><CheckCircle className="h-4 w-4" />{msg}</div>}
        {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{err}</div>}
        <button type="submit" disabled={saving} className="btn-primary h-10 w-full">{saving ? "Updating…" : "Update password"}</button>
      </form>
    </div>
  );
}
