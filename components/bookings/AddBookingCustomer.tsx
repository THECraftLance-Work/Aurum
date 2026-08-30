"use client";
import { useState } from "react";

export default function AddBookingCustomer({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/customers`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });
    setBusy(false);
    if (!res.ok) { const body = await res.json().catch(() => ({})); setError(body.error ?? "Could not attach customer."); return; }
    window.location.reload();
  }

  if (!open) return <button type="button" className="btn-secondary h-9 text-xs" onClick={() => setOpen(true)}>Attach person</button>;

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-border bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input className="input" required placeholder="Full name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      </div>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={busy} className="btn-primary h-9 text-xs">{busy ? "Attaching…" : "Attach person"}</button>
        <button type="button" className="btn-secondary h-9 text-xs" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
