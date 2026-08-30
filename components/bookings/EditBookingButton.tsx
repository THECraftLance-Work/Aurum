"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Booking = { id: string; project_name: string; unit_number: string; property_details?: string | null; total_property_value: number; notes?: string | null; booking_place?: string | null; booking_date?: string | null; block?: string | null; facing?: string | null };

export default function EditBookingButton({ booking }: { booking: Booking }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...booking, property_details: booking.property_details ?? "", notes: booking.notes ?? "", booking_place: booking.booking_place ?? "", booking_date: booking.booking_date ?? "", block: booking.block ?? "", facing: booking.facing ?? "" });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const response = await fetch(`/api/bookings/${booking.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "Could not update booking."); return; }
    setOpen(false); router.refresh();
  }

  return <>
    <button type="button" className="btn-secondary h-10" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> Edit</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button type="button" aria-label="Close edit booking" className="absolute inset-0 bg-slate-900/40" onClick={() => !busy && setOpen(false)} /><form onSubmit={submit} className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-pop"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-900">Correct booking details</h2><p className="mt-1 text-xs text-slate-500">Saving changes sends this booking back for verification.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="h-4 w-4" /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Project / property name *" value={form.project_name} onChange={(v) => update("project_name", v)} /><Field label="Unit / flat number *" value={form.unit_number} onChange={(v) => update("unit_number", v)} /><Field label="Total property value *" value={String(form.total_property_value)} onChange={(v) => update("total_property_value", v)} type="number" /><Field label="Booking place" value={form.booking_place} onChange={(v) => update("booking_place", v)} /><Field label="Booking date" value={form.booking_date} onChange={(v) => update("booking_date", v)} type="date" /><Field label="Block" value={form.block} onChange={(v) => update("block", v)} /><Field label="Facing" value={form.facing} onChange={(v) => update("facing", v)} /><label className="sm:col-span-2"><span className="label">Property details</span><textarea className="input min-h-20" value={form.property_details} onChange={(e) => update("property_details", e.target.value)} /></label><label className="sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label></div>{error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-secondary h-10" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary h-10" disabled={busy}>{busy ? "Saving…" : "Save and resubmit"}</button></div></form></div>}
  </>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="label">{label}</span><input className="input" required={label.includes("*")} type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
