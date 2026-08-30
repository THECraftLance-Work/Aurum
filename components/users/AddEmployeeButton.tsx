"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export default function AddEmployeeButton() {
  const router = useRouter(); const { toast } = useToast();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "SM", password: "" });
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(null); const res = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }); const body = await res.json().catch(() => ({})); setBusy(false); if (!res.ok) { setError(body.error ?? "Could not create employee."); return; } toast({ tone: "success", title: "Employee account created", description: `${form.email} can sign in immediately.` }); setOpen(false); setForm({ name: "", email: "", phone: "", role: "SM", password: "" }); router.refresh(); }
  return <>
    <button className="btn-primary h-10" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Employee</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/40" onClick={() => !busy && setOpen(false)} /><form onSubmit={submit} className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-pop"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">Add employee</h2><button type="button" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div><p className="mt-1 text-xs text-slate-500">This account is approved immediately and bypasses the access request queue.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input className="input" required placeholder="Full name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input className="input" required type="email" placeholder="Work email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input className="input" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="SM">Sales Manager</option><option value="CP">Channel Partner</option><option value="ACCOUNTANT">Accountant</option><option value="ADMIN">Admin</option></select><input className="input md:col-span-2" required minLength={8} type="password" placeholder="Temporary password (8+ characters) *" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>{error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-secondary h-10" onClick={() => setOpen(false)}>Cancel</button><button disabled={busy} className="btn-primary h-10">{busy ? "Creating…" : "Create account"}</button></div></form></div>}
  </>;
}
