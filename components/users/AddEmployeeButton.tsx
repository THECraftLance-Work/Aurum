"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export default function AddEmployeeButton() {
  const router = useRouter(); const { toast } = useToast();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "SM", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(null); const res = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }); const body = await res.json().catch(() => ({})); setBusy(false); if (!res.ok) { setError(body.error ?? "Could not create employee."); return; } toast({ tone: "success", title: "Employee account created", description: `${form.email} can sign in immediately with email + password.` }); setOpen(false); setForm({ name: "", email: "", phone: "", role: "SM", password: "" }); setShowPw(false); router.refresh(); }
  const drawer = open ? (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
      <div className="relative flex h-full w-full max-w-[440px] flex-col bg-white shadow-2xl animate-rm-in overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0"><div><h2 className="text-base font-semibold text-slate-900">Add employee</h2><p className="mt-1 text-xs text-slate-500">Director-created accounts are approved immediately and sign in with email + password (Google sign-in remains for Workspace users).</p></div><button type="button" onClick={() => !busy && setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button></div>
        <form onSubmit={submit} className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className="label">Full name *</span><input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label><span className="label">Work email *</span><input className="input" required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            <label><span className="label">Phone</span><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
            <label><span className="label">Role *</span><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="SM">Sales Manager</option><option value="CP">Channel Partner</option><option value="ACCOUNTANT">Accountant</option><option value="ADMIN">Admin</option></select></label>
            <label className="md:col-span-2"><span className="label">Temporary password *</span><div className="relative"><input className="input pr-10" required minLength={8} type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100 text-slate-500" tabIndex={-1}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
          </div>
          {error && <p className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="mt-auto flex justify-end gap-2 pt-6"><button type="button" className="btn-secondary h-10" onClick={() => setOpen(false)} disabled={busy}>Cancel</button><button disabled={busy} className="btn-primary h-10 min-w-[130px]">{busy ? "Creating…" : "Create account"}</button></div>
        </form>
      </div>
    </div>
  ) : null;
  return <>
    <button className="btn-primary h-10" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Employee</button>
    {mounted && drawer ? createPortal(drawer, document.body) : drawer}
  </>;
}
