"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Booking = {
  id: string;
  project_name: string;
  unit_number: string;
  property_details?: string | null;
  total_property_value: number;
  notes?: string | null;
  booking_place?: string | null;
  booking_date?: string | null;
  block?: string | null;
  facing?: string | null;
  sales_representative?: string | null;
  team_manager?: string | null;
  saleable_area?: string | number | null;
  carpet_area?: string | number | null;
  external_walls_area?: string | number | null;
  balcony_utility_area?: string | number | null;
  common_area?: string | number | null;
  sale_consideration_per_sqft?: string | number | null;
  source_of_booking?: string | null;
  payment_source?: string | null;
  purchase_purpose?: string | null;
  cp_agent_name?: string | null;
  cp_rera_id?: string | null;
};

export default function EditBookingButton({ booking }: { booking: Booking }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_name: booking.project_name ?? "",
    unit_number: booking.unit_number ?? "",
    total_property_value: String(booking.total_property_value ?? ""),
    property_details: booking.property_details ?? "",
    notes: booking.notes ?? "",
    booking_place: booking.booking_place ?? "",
    booking_date: booking.booking_date ?? "",
    block: booking.block ?? "",
    facing: booking.facing ?? "",
    sales_representative: (booking as any).sales_representative ?? "",
    team_manager: (booking as any).team_manager ?? "",
    saleable_area: String((booking as any).saleable_area ?? ""),
    carpet_area: String((booking as any).carpet_area ?? ""),
    external_walls_area: String((booking as any).external_walls_area ?? ""),
    balcony_utility_area: String((booking as any).balcony_utility_area ?? ""),
    common_area: String((booking as any).common_area ?? ""),
    sale_consideration_per_sqft: String((booking as any).sale_consideration_per_sqft ?? ""),
    source_of_booking: (booking as any).source_of_booking ?? "",
    payment_source: (booking as any).payment_source ?? "",
    purchase_purpose: (booking as any).purchase_purpose ?? "",
    cp_agent_name: (booking as any).cp_agent_name ?? "",
    cp_rera_id: (booking as any).cp_rera_id ?? "",
  });
  const update = (key: keyof typeof form, value: string) => setForm((c) => ({ ...c, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: any = {
      project_name: form.project_name,
      unit_number: form.unit_number,
      total_property_value: form.total_property_value,
      property_details: form.property_details,
      notes: form.notes,
      booking_place: form.booking_place,
      booking_date: form.booking_date || null,
      block: form.block,
      facing: form.facing,
      sales_representative: form.sales_representative,
      team_manager: form.team_manager,
      saleable_area: form.saleable_area ? Number(form.saleable_area) : null,
      carpet_area: form.carpet_area ? Number(form.carpet_area) : null,
      external_walls_area: form.external_walls_area ? Number(form.external_walls_area) : null,
      balcony_utility_area: form.balcony_utility_area ? Number(form.balcony_utility_area) : null,
      common_area: form.common_area ? Number(form.common_area) : null,
      sale_consideration_per_sqft: form.sale_consideration_per_sqft ? Number(form.sale_consideration_per_sqft) : null,
      source_of_booking: form.source_of_booking,
      payment_source: form.payment_source,
      purchase_purpose: form.purchase_purpose,
      cp_agent_name: form.cp_agent_name,
      cp_rera_id: form.cp_rera_id,
    };
    const response = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not update booking.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-secondary h-10" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Edit
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-sm p-4">
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0"
            onClick={() => !busy && setOpen(false)}
            tabIndex={-1}
          />
          <form
            onSubmit={submit}
            className="relative my-8 w-full max-w-3xl self-start rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Correct booking details</h2>
                <p className="mt-1 text-xs text-slate-500">All fields are editable as text. Saving sends this booking back for verification.</p>
              </div>
              <button type="button" onClick={() => !busy && setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6">
              <Section title="Property">
                <Field label="Project / property name *" value={form.project_name} onChange={(v) => update("project_name", v)} required />
                <Field label="Unit / flat number *" value={form.unit_number} onChange={(v) => update("unit_number", v)} required />
                <Field label="Total property value *" value={form.total_property_value} onChange={(v) => update("total_property_value", v)} type="number" required />
                <Field label="Facing" value={form.facing} onChange={(v) => update("facing", v)} placeholder="South / East" />
                <Field label="Block" value={form.block} onChange={(v) => update("block", v)} />
                <Field label="Booking place" value={form.booking_place} onChange={(v) => update("booking_place", v)} />
                <Field label="Booking date" value={form.booking_date} onChange={(v) => update("booking_date", v)} type="date" />
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="label">Property details</span>
                    <textarea className="input min-h-[80px]" value={form.property_details} onChange={(e) => update("property_details", e.target.value)} />
                  </label>
                </div>
              </Section>

              <Section title="Booking form details">
                <Field label="Sales representative" value={form.sales_representative} onChange={(v) => update("sales_representative", v)} />
                <Field label="Team manager" value={form.team_manager} onChange={(v) => update("team_manager", v)} />
                <Field label="Saleable area (Sq.ft)" value={form.saleable_area} onChange={(v) => update("saleable_area", v)} type="number" />
                <Field label="Carpet area (Sq.ft)" value={form.carpet_area} onChange={(v) => update("carpet_area", v)} type="number" />
                <Field label="External walls area (Sq.ft)" value={form.external_walls_area} onChange={(v) => update("external_walls_area", v)} type="number" />
                <Field label="Balcony & utility area (Sq.ft)" value={form.balcony_utility_area} onChange={(v) => update("balcony_utility_area", v)} type="number" />
                <Field label="Common area (Sq.ft)" value={form.common_area} onChange={(v) => update("common_area", v)} type="number" />
                <Field label="Sale consideration / Sq.ft" value={form.sale_consideration_per_sqft} onChange={(v) => update("sale_consideration_per_sqft", v)} type="number" />
                <Field label="Source of booking" value={form.source_of_booking} onChange={(v) => update("source_of_booking", v)} />
                <Field label="Payment source" value={form.payment_source} onChange={(v) => update("payment_source", v)} />
                <Field label="Purpose of purchase" value={form.purchase_purpose} onChange={(v) => update("purchase_purpose", v)} />
                <Field label="CP agent name" value={form.cp_agent_name} onChange={(v) => update("cp_agent_name", v)} />
                <Field label="CP RERA ID" value={form.cp_rera_id} onChange={(v) => update("cp_rera_id", v)} />
              </Section>

              <Section title="Notes">
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="label">Notes</span>
                    <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
                  </label>
                </div>
              </Section>

              {error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</p>}
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-2xl shrink-0">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary" disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn-primary min-w-[110px]" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </span>
      <input className="input" required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
