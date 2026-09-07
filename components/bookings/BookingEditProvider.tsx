"use client";
import { createContext, useContext, useState } from "react";
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

type Ctx = {
  editing: boolean;
  setEditing: (v: boolean) => void;
  form: Record<string, string>;
  update: (k: string, v: string) => void;
  busy: boolean;
  error: string | null;
  save: () => Promise<void>;
  cancel: () => void;
};

const BookingEditCtx = createContext<Ctx | null>(null);
export const useBookingEdit = () => {
  const c = useContext(BookingEditCtx);
  if (!c) throw new Error("useBookingEdit outside provider");
  return c;
};

export function BookingEditProvider({ booking, children }: { booking: Booking; children: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial = {
    project_name: booking.project_name ?? "",
    unit_number: booking.unit_number ?? "",
    total_property_value: String(booking.total_property_value ?? ""),
    property_details: booking.property_details ?? "",
    notes: booking.notes ?? "",
    booking_place: booking.booking_place ?? "",
    booking_date: booking.booking_date ?? "",
    block: booking.block ?? "",
    facing: booking.facing ?? "",
    sales_representative: booking.sales_representative ?? "",
    team_manager: booking.team_manager ?? "",
    saleable_area: String(booking.saleable_area ?? ""),
    carpet_area: String(booking.carpet_area ?? ""),
    external_walls_area: String(booking.external_walls_area ?? ""),
    balcony_utility_area: String(booking.balcony_utility_area ?? ""),
    common_area: String(booking.common_area ?? ""),
    sale_consideration_per_sqft: String(booking.sale_consideration_per_sqft ?? ""),
    source_of_booking: booking.source_of_booking ?? "",
    payment_source: booking.payment_source ?? "",
    purchase_purpose: booking.purchase_purpose ?? "",
    cp_agent_name: booking.cp_agent_name ?? "",
    cp_rera_id: booking.cp_rera_id ?? "",
  };
  const [form, setForm] = useState(initial);
  const update = (k: string, v: string) => setForm((c) => ({ ...c, [k]: v }));

  function cancel() {
    setForm(initial);
    setError(null);
    setEditing(false);
  }

  async function save() {
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
    const res = await fetch(`/api/bookings/${booking.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error ?? "Could not save."); return; }
    setEditing(false);
    router.refresh();
  }

  return (
    <BookingEditCtx.Provider value={{ editing, setEditing, form, update, busy, error, save, cancel }}>
      {children}
    </BookingEditCtx.Provider>
  );
}
