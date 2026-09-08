"use client";
import { useBookingEdit } from "./BookingEditProvider";
import CollapsibleCard from "@/components/ui/CollapsibleCard";

export default function InlineBookingEditor({ booking }: { booking: any }) {
  const { editing, form, update, error } = useBookingEdit();
  return (
    <>
      <CollapsibleCard title="Property" defaultOpen={true}>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project *" value={form.project_name} onChange={(v) => update("project_name", v)} />
            <Field label="Unit *" value={form.unit_number} onChange={(v) => update("unit_number", v)} />
            <Field label="Facing" value={form.facing} onChange={(v) => update("facing", v)} />
            <Field label="Block" value={form.block} onChange={(v) => update("block", v)} />
            <Field label="Booking place" value={form.booking_place} onChange={(v) => update("booking_place", v)} />
            <Field label="Booking date" value={form.booking_date} onChange={(v) => update("booking_date", v)} type="date" />
            <label className="sm:col-span-2"><span className="label">Property details</span><textarea className="input min-h-[80px]" value={form.property_details} onChange={(e) => update("property_details", e.target.value)} /></label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Project" value={booking.project_name} />
            <Info label="Unit" value={booking.unit_number} />
            <Info label="Details" value={booking.property_details ?? "—"} span />
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="Booking form details" defaultOpen={true}>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sales representative" value={form.sales_representative} onChange={(v) => update("sales_representative", v)} />
            <Field label="Team manager" value={form.team_manager} onChange={(v) => update("team_manager", v)} />
            <Field label="Saleable area (Sq.ft)" value={form.saleable_area} onChange={(v) => update("saleable_area", v)} type="number" />
            <Field label="Carpet area (Sq.ft)" value={form.carpet_area} onChange={(v) => update("carpet_area", v)} type="number" />
            <Field label="External walls area (Sq.ft)" value={form.external_walls_area} onChange={(v) => update("external_walls_area", v)} type="number" />
            <Field label="Balcony & utility area (Sq.ft)" value={form.balcony_utility_area} onChange={(v) => update("balcony_utility_area", v)} type="number" />
            <Field label="Common area (Sq.ft)" value={form.common_area} onChange={(v) => update("common_area", v)} type="number" />
            <Field label="Sale consideration / Sq.ft" value={form.sale_consideration_per_sqft} onChange={(v) => update("sale_consideration_per_sqft", v)} type="number" />
            <Field label="Total property value *" value={form.total_property_value} onChange={(v) => update("total_property_value", v)} type="number" />
            <Field label="Source of booking" value={form.source_of_booking} onChange={(v) => update("source_of_booking", v)} />
            <Field label="Payment source" value={form.payment_source} onChange={(v) => update("payment_source", v)} />
            <Field label="Purpose of purchase" value={form.purchase_purpose} onChange={(v) => update("purchase_purpose", v)} />
            <Field label="CP / agent name" value={form.cp_agent_name} onChange={(v) => update("cp_agent_name", v)} />
            <Field label="CP RERA ID" value={form.cp_rera_id} onChange={(v) => update("cp_rera_id", v)} />
            <label className="sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Sales representative" value={booking.sales_representative ?? "—"} />
            <Info label="Team manager" value={booking.team_manager ?? "—"} />
            <Info label="Booking place" value={booking.booking_place ?? "—"} />
            <Info label="Booking date" value={booking.booking_date ?? "—"} />
            <Info label="Block" value={booking.block ?? "—"} />
            <Info label="Facing" value={booking.facing ?? "—"} />
            <Info label="Saleable area" value={booking.saleable_area ? `${booking.saleable_area} Sq.ft` : "—"} />
            <Info label="Carpet area" value={booking.carpet_area ? `${booking.carpet_area} Sq.ft` : "—"} />
            <Info label="External walls area" value={booking.external_walls_area ? `${booking.external_walls_area} Sq.ft` : "—"} />
            <Info label="Balcony & utility area" value={booking.balcony_utility_area ? `${booking.balcony_utility_area} Sq.ft` : "—"} />
            <Info label="Common area" value={booking.common_area ? `${booking.common_area} Sq.ft` : "—"} />
            <Info label="Sale consideration / Sq.ft" value={booking.sale_consideration_per_sqft ? String(booking.sale_consideration_per_sqft) : "—"} />
            <Info label="Source of booking" value={booking.source_of_booking ?? "—"} />
            <Info label="Payment source" value={booking.payment_source ?? "—"} />
            <Info label="Purpose of purchase" value={booking.purchase_purpose ?? "—"} />
            <Info label="CP / referral" value={[booking.cp_agent_name, booking.cp_rera_id].filter(Boolean).join(" · ") || "—"} />
            {booking.notes && <Info label="Notes" value={booking.notes} span />}
          </div>
        )}
      </CollapsibleCard>
      {editing && error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </>
  );
}
function Info({ label, value, span }: { label: string; value: React.ReactNode; span?: boolean }) {
  return <div className={`min-w-0 ${span ? "col-span-2" : ""}`}><div className="text-xs text-slate-500">{label}</div><div className="mt-0.5 break-words text-slate-900">{value}</div></div>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block"><span className="label">{label}</span><input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
