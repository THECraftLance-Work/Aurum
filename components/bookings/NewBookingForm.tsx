"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/utils/format";
import FileUpload, { type UploadedFile } from "@/components/ui/FileUpload";
import { bookingSchema, customerSchema, validationMessage } from "@/lib/validation/booking";

const PAYMENT_MODES = [
  "BANK_TRANSFER",
  "UPI",
  "CHEQUE",
  "CASH",
  "CARD",
  "OTHER",
];

export default function NewBookingForm({ role }: { role: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<UploadedFile | null>(null);
  const emptyCustomer = {
    title: "",
    name: "",
    relation_type: "",
    father_spouse_name: "",
    date_of_birth: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    pin_code: "",
    phone: "",
    alternate_phone: "",
    email: "",
    alternate_email: "",
    pan_number: "",
    aadhaar_number: "",
    occupation: "",
    organization: "",
    designation: "",
  };
  const [customers, setCustomers] = useState([emptyCustomer]);
  const [saveData, setSaveData] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [form, setForm] = useState({
    project_name: "",
    unit_number: "",
    property_details: "",
    total_property_value: "",
    previous_payments: "0",
    current_payment: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_mode: "BANK_TRANSFER",
    reference_no: "",
    notes: "",
    bank_name: "",
    bank_account_holder: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_branch: "",
    loan_sanctioned: "no",
    loan_amount: "",
    sales_representative: "",
    team_manager: "",
    booking_place: "",
    booking_date: new Date().toISOString().slice(0, 10),
    block: "",
    facing: "",
    saleable_area: "",
    carpet_area: "",
    external_walls_area: "",
    balcony_utility_area: "",
    common_area: "",
    base_price: "",
    floor_rise_charges: "",
    east_facing_charges: "",
    premium_view_charges: "",
    amenities_charges: "",
    car_parking_charges: "",
    legal_documentation_charges: "",
    sale_consideration_per_sqft: "",
    source_of_booking: "",
    referral_customer_name: "",
    referral_project_name: "",
    cp_agent_name: "",
    cp_rera_id: "",
    payment_source: "",
    purchase_purpose: "",
  });

  const draftKey = "new-booking-draft";
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved?.form) setForm((current) => ({ ...current, ...saved.form }));
      if (Array.isArray(saved?.customers) && saved.customers.length) setCustomers(saved.customers);
      setSaveData(localStorage.getItem("new-booking-save-data") === "on");
    } catch { /* Browser storage is optional. */ }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady || !saveData) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ form, customers })); } catch { /* Browser storage is optional. */ }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [form, customers, saveData, draftReady]);

  function toggleSaveData(next: boolean) {
    setSaveData(next);
    try {
      localStorage.setItem("new-booking-save-data", next ? "on" : "off");
      if (!next) localStorage.removeItem(draftKey);
    } catch { /* Browser storage is optional. */ }
  }

  function upd<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function updCustomer(
    index: number,
    key: keyof typeof emptyCustomer,
    value: string,
  ) {
    setCustomers((items) =>
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  const total = Number(form.total_property_value || 0);
  const previous = Number(form.previous_payments || 0);
  const current = Number(form.current_payment || 0);
  const totalPaid = previous + current;
  const remaining = Math.max(0, total - totalPaid);

  // Indian IFSC: 4 letters, a literal 0, then 6 alphanumerics.
  const ifscInvalid =
    form.bank_ifsc.trim().length > 0 &&
    !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank_ifsc.trim());

  const validation = useMemo(() => {
    const customerResult = customers.map((customer) => customerSchema.safeParse(customer)).find((result) => !result.success);
    if (customerResult && !customerResult.success) return { valid: false, message: validationMessage(customerResult) };
    const result = bookingSchema.safeParse(form);
    return result.success ? { valid: true, message: null } : { valid: false, message: validationMessage(result) };
  }, [customers, form]);
  const valid = validation.valid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validation.valid) { setError(validation.message); return; }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customers: customers.map((c) => ({
          ...c,
          name: c.name.trim(),
          // Keep the selected relationship with the existing database field.
          father_spouse_name: c.father_spouse_name.trim()
            ? `${c.relation_type}: ${c.father_spouse_name.trim()}`
            : null,
          relation_type: undefined,
          phone: c.phone.trim() || null,
          email: c.email.trim() || null,
        })),
        booking: {
          project_name: form.project_name.trim(),
          unit_number: form.unit_number.trim(),
          property_details: form.property_details.trim() || null,
          total_property_value: total,
          notes: form.notes.trim() || null,
          bank_name: form.bank_name.trim() || null,
          bank_account_holder: form.bank_account_holder.trim() || null,
          bank_account_number: form.bank_account_number.trim() || null,
          bank_ifsc: form.bank_ifsc.trim() || null,
          bank_branch: form.bank_branch.trim() || null,
          loan_sanctioned: form.loan_sanctioned === "yes",
          loan_amount:
            form.loan_sanctioned === "yes" && form.loan_amount
              ? Number(form.loan_amount)
              : null,
          sales_representative: form.sales_representative.trim() || null,
          team_manager: form.team_manager.trim() || null,
          booking_place: form.booking_place.trim() || null,
          booking_date: form.booking_date || null,
          block: form.block.trim() || null,
          facing: form.facing.trim() || null,
          saleable_area: Number(form.saleable_area) || null,
          carpet_area: Number(form.carpet_area) || null,
          external_walls_area: Number(form.external_walls_area) || null,
          balcony_utility_area: Number(form.balcony_utility_area) || null,
          common_area: Number(form.common_area) || null,
          base_price: Number(form.base_price) || null,
          floor_rise_charges: Number(form.floor_rise_charges) || null,
          east_facing_charges: Number(form.east_facing_charges) || null,
          premium_view_charges: Number(form.premium_view_charges) || null,
          amenities_charges: Number(form.amenities_charges) || null,
          car_parking_charges: Number(form.car_parking_charges) || null,
          legal_documentation_charges:
            Number(form.legal_documentation_charges) || null,
          sale_consideration_per_sqft:
            Number(form.sale_consideration_per_sqft) || null,
          source_of_booking: form.source_of_booking.trim() || null,
          referral_customer_name: form.referral_customer_name.trim() || null,
          referral_project_name: form.referral_project_name.trim() || null,
          cp_agent_name: form.cp_agent_name.trim() || null,
          cp_rera_id: form.cp_rera_id.trim() || null,
          payment_source: form.payment_source.trim() || null,
          purchase_purpose: form.purchase_purpose.trim() || null,
        },
        attachment: doc
          ? {
              storagePath: doc.storagePath,
              name: doc.name,
              size: doc.size,
              type: doc.type,
            }
          : null,
        initialPayment:
          current > 0
            ? {
                amount: current,
                payment_date: form.payment_date,
                payment_mode: form.payment_mode,
                reference_no: form.reference_no.trim() || null,
              }
            : null,
        previousPayments: previous,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setError(j.error ?? "Failed to create booking.");
    }
    const { id } = await res.json();
    try { localStorage.removeItem(draftKey); } catch { /* Browser storage is optional. */ }
    router.push(`/bookings/${id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="max-h-[calc(95vh-130px)] overflow-y-auto overscroll-contain pr-1 grid gap-4 xl:grid-cols-3"
    >
      <div className="sticky top-0 z-20 -mb-1 flex justify-end bg-slate-50/95 py-2 backdrop-blur-sm xl:col-span-3">
        <label className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
          <span>Save data while filling</span>
          <button type="button" role="switch" aria-checked={saveData} aria-label="Save data while filling" onClick={() => toggleSaveData(!saveData)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${saveData ? "bg-emerald-600" : "bg-slate-300"}`}>
            <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${saveData ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </label>
      </div>
      <div className="xl:col-span-2 space-y-4">
        <Section title="Customer details">
          <div className="space-y-4">
            {customers.map((customer, index) => (
              <div key={index} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {index === 0
                      ? "Primary customer"
                      : `Additional customer ${index + 1}`}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      className="text-xs text-rose-600"
                      onClick={() =>
                        setCustomers((items) =>
                          items.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Grid>
                  <Field
                    label="Title"
                    v={customer.title}
                    onChange={(v) => updCustomer(index, "title", v)}
                  />
                  <Field
                    label="Full name *"
                    v={customer.name}
                    onChange={(v) => updCustomer(index, "name", v)}
                  />
                  <Select
                    label="Relationship"
                    v={customer.relation_type}
                    onChange={(v) => updCustomer(index, "relation_type", v)}
                    options={["", "S/o", "W/o", "D/o"]}
                  />
                  {customer.relation_type && (
                    <Field
                      label={`${customer.relation_type} name *`}
                      v={customer.father_spouse_name}
                      onChange={(v) =>
                        updCustomer(index, "father_spouse_name", v)
                      }
                      required
                    />
                  )}
                  <Field
                    label="Date of birth"
                    v={customer.date_of_birth}
                    onChange={(v) => updCustomer(index, "date_of_birth", v)}
                    type="date"
                  />
                  <TextArea
                    label="Address"
                    v={customer.address}
                    onChange={(v) => updCustomer(index, "address", v)}
                    rows={2}
                    full
                  />
                  <Field
                    label="City"
                    v={customer.city}
                    onChange={(v) => updCustomer(index, "city", v)}
                  />
                  <Field
                    label="State"
                    v={customer.state}
                    onChange={(v) => updCustomer(index, "state", v)}
                  />
                  <Field
                    label="Country"
                    v={customer.country}
                    onChange={(v) => updCustomer(index, "country", v)}
                  />
                  <Field
                    label="PIN code"
                    v={customer.pin_code}
                    onChange={(v) => updCustomer(index, "pin_code", v)}
                  />
                  <Field
                    label="Phone"
                    v={customer.phone}
                    onChange={(v) => updCustomer(index, "phone", v)}
                  />
                  <Field
                    label="Alternate phone"
                    v={customer.alternate_phone}
                    onChange={(v) => updCustomer(index, "alternate_phone", v)}
                  />
                  <Field
                    label="Email"
                    v={customer.email}
                    onChange={(v) => updCustomer(index, "email", v)}
                    type="email"
                  />
                  <Field
                    label="Alternate email"
                    v={customer.alternate_email}
                    onChange={(v) => updCustomer(index, "alternate_email", v)}
                    type="email"
                  />
                  <Field
                    label="PAN number"
                    v={customer.pan_number}
                    onChange={(v) =>
                      updCustomer(index, "pan_number", v.toUpperCase())
                    }
                    pattern="[A-Z]{5}[0-9]{4}[A-Z]"
                    maxLength={10}
                  />
                  <Field
                    label="Aadhaar number"
                    v={customer.aadhaar_number}
                    onChange={(v) =>
                      updCustomer(index, "aadhaar_number", v.replace(/\D/g, "").slice(0, 12))
                    }
                    inputMode="numeric"
                    pattern="[2-9][0-9]{11}"
                    maxLength={12}
                  />
                  <Field
                    label="Occupation"
                    v={customer.occupation}
                    onChange={(v) => updCustomer(index, "occupation", v)}
                  />
                  <Field
                    label="Organization"
                    v={customer.organization}
                    onChange={(v) => updCustomer(index, "organization", v)}
                  />
                  <Field
                    label="Designation"
                    v={customer.designation}
                    onChange={(v) => updCustomer(index, "designation", v)}
                  />
                </Grid>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary h-10 text-sm"
              onClick={() =>
                setCustomers((items) => [...items, { ...emptyCustomer }])
              }
            >
              + Add another person
            </button>
          </div>
        </Section>

        <Section title="Booking details">
          <Grid>
            <Field
              label="Sales representative"
              v={form.sales_representative}
              onChange={(v) => upd("sales_representative", v)}
            />
            <Field
              label="Team manager"
              v={form.team_manager}
              onChange={(v) => upd("team_manager", v)}
            />
            <Field
              label="Booking place"
              v={form.booking_place}
              onChange={(v) => upd("booking_place", v)}
            />
            <Field
              label="Booking date"
              v={form.booking_date}
              onChange={(v) => upd("booking_date", v)}
              type="date"
            />
            <Field
              label="Project / property name *"
              v={form.project_name}
              onChange={(v) => upd("project_name", v)}
            />
            <Field
              label="Unit / flat number *"
              v={form.unit_number}
              onChange={(v) => upd("unit_number", v)}
            />
            <Field
              label="Block"
              v={form.block}
              onChange={(v) => upd("block", v)}
            />
            <Field
              label="Facing"
              v={form.facing}
              onChange={(v) => upd("facing", v)}
            />
            <TextArea
              label="Property details"
              v={form.property_details}
              onChange={(v) => upd("property_details", v)}
              rows={3}
              full
            />
          </Grid>
        </Section>

        <Section title="Sale consideration & areas">
          <Grid>
            {(
              [
                "saleable_area",
                "carpet_area",
                "external_walls_area",
                "balcony_utility_area",
                "common_area",
              ] as const
            ).map((key) => (
              <Field
                key={key}
                label={key.replaceAll("_", " ")}
                v={form[key]}
                onChange={(v) => upd(key, v)}
                type="number"
                min={0}
                step={0.01}
              />
            ))}
            {(
              [
                "base_price",
                "floor_rise_charges",
                "east_facing_charges",
                "premium_view_charges",
                "amenities_charges",
                "car_parking_charges",
                "legal_documentation_charges",
                "sale_consideration_per_sqft",
              ] as const
            ).map((key) => (
              <Field
                key={key}
                label={key.replaceAll("_", " ") + " (₹)"}
                v={form[key]}
                onChange={(v) => upd(key, v)}
                type="number"
                min={0}
                step={0.01}
              />
            ))}
          </Grid>
        </Section>

        <Section title="Source & purchase details">
          <Grid>
            <Field
              label="Source of booking"
              v={form.source_of_booking}
              onChange={(v) => upd("source_of_booking", v)}
            />
            <Field
              label="Payment source"
              v={form.payment_source}
              onChange={(v) => upd("payment_source", v)}
            />
            <Field
              label="Purpose of purchase"
              v={form.purchase_purpose}
              onChange={(v) => upd("purchase_purpose", v)}
            />
            <Field
              label="Referral customer name"
              v={form.referral_customer_name}
              onChange={(v) => upd("referral_customer_name", v)}
            />
            <Field
              label="Referral project name"
              v={form.referral_project_name}
              onChange={(v) => upd("referral_project_name", v)}
            />
            <Field
              label="CP agent / organization"
              v={form.cp_agent_name}
              onChange={(v) => upd("cp_agent_name", v)}
            />
            <Field
              label="CP RERA ID"
              v={form.cp_rera_id}
              onChange={(v) => upd("cp_rera_id", v)}
            />
          </Grid>
        </Section>

        <Section title="Bank details">
          <Grid>
            <Field
              label="Bank name"
              v={form.bank_name}
              onChange={(v) => upd("bank_name", v)}
            />
            <Field
              label="Branch"
              v={form.bank_branch}
              onChange={(v) => upd("bank_branch", v)}
            />
            <Field
              label="Account holder name"
              v={form.bank_account_holder}
              onChange={(v) => upd("bank_account_holder", v)}
            />
            <Field
              label="Account number"
              v={form.bank_account_number}
              onChange={(v) => upd("bank_account_number", v)}
            />
            <Field
              label="IFSC code"
              v={form.bank_ifsc}
              onChange={(v) => upd("bank_ifsc", v.toUpperCase())}
            />
            <Select
              label="Home loan sanctioned"
              v={form.loan_sanctioned}
              onChange={(v) => upd("loan_sanctioned", v)}
              options={["no", "yes"]}
            />
            {form.loan_sanctioned === "yes" && (
              <Field
                label="Loan amount (₹)"
                v={form.loan_amount}
                onChange={(v) => upd("loan_amount", v)}
                type="number"
                min={0}
                step={1}
              />
            )}
          </Grid>
          {ifscInvalid && (
            <p className="mt-2 text-xs text-amber-700">
              IFSC codes are 11 characters: 4 letters, a 0, then 6 alphanumerics
              (e.g. HDFC0001234).
            </p>
          )}
        </Section>

        <Section title="Financial details & proof">
          <Grid>
            <Field
              label="Total property value *"
              v={form.total_property_value}
              onChange={(v) => upd("total_property_value", v)}
              type="number"
              min={0}
              step={1}
            />
            <Field
              label="Previous payments (₹)"
              v={form.previous_payments}
              onChange={(v) => upd("previous_payments", v)}
              type="number"
              min={0}
              step={1}
            />
            <Field
              label="Current payment (₹)"
              v={form.current_payment}
              onChange={(v) => upd("current_payment", v)}
              type="number"
              min={0}
              step={1}
            />
            <Field
              label="Payment date"
              v={form.payment_date}
              onChange={(v) => upd("payment_date", v)}
              type="date"
            />
            <Select
              label="Payment mode"
              v={form.payment_mode}
              onChange={(v) => upd("payment_mode", v)}
              options={PAYMENT_MODES}
            />
            <Field
              label="Reference no."
              v={form.reference_no}
              onChange={(v) => upd("reference_no", v)}
            />
            <TextArea
              label="Notes"
              v={form.notes}
              onChange={(v) => upd("notes", v)}
              rows={2}
              full
            />
            <div className="col-span-2">
              <FileUpload
                label="Booking agreement / payment proof"
                helper="Upload customer ID, booking agreement or payment receipt (PDF, PNG, JPG)"
                onFileSelect={(f) => setDoc(f)}
                value={doc}
              />
            </div>
          </Grid>
        </Section>
      </div>

      <aside className="space-y-4 self-start xl:sticky xl:top-24">
        <div className="card p-5 sticky top-24">
          <h3 className="text-sm font-semibold text-slate-900">Live summary</h3>
          <div className="mt-4 space-y-3 text-sm">
            <SummaryRow label="Total property value" value={formatINR(total)} />
            <SummaryRow label="Previous payments" value={formatINR(previous)} />
            <SummaryRow
              label="Current payment"
              value={formatINR(current)}
              accent="emerald"
            />
            <div className="divider my-2" />
            <SummaryRow label="Total paid" value={formatINR(totalPaid)} bold />
            <SummaryRow
              label="Remaining balance"
              value={formatINR(remaining)}
              accent="amber"
              bold
            />
          </div>
          {!valid && validation.message && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <p className="font-semibold">Please correct the following before submitting:</p>
              <p className="mt-1 break-words">{validation.message}</p>
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {totalPaid > total && total > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              Payments cannot exceed the total value.
            </div>
          )}
          <button
            disabled={busy || !valid}
            className="btn-primary w-full mt-5 h-11"
          >
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed">
            A Booking ID is generated when this form is submitted. Accountants
            will be notified for verification.
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
            Submitting as {role}
          </p>
        </div>
      </aside>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  );
}
function Field(props: {
  label: string;
  v: string;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  step?: number;
  required?: boolean;
  pattern?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="label">{props.label}</label>
      <input
        className="input"
        value={props.v}
        onChange={(e) => props.onChange(e.target.value)}
        type={props.type ?? "text"}
        min={props.min}
        step={props.step}
        required={props.required}
        pattern={props.pattern}
        maxLength={props.maxLength}
        inputMode={props.inputMode}
      />
    </div>
  );
}
function TextArea(props: {
  label: string;
  v: string;
  onChange: (v: string) => void;
  rows?: number;
  full?: boolean;
}) {
  return (
    <div className={props.full ? "md:col-span-2" : ""}>
      <label className="label">{props.label}</label>
      <textarea
        className="input min-h-[88px]"
        rows={props.rows ?? 3}
        value={props.v}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
function Select(props: {
  label: string;
  v: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="label">{props.label}</label>
      <select
        className="input"
        value={props.v}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o ? o.replaceAll("_", " ") : "Select an option"}
          </option>
        ))}
      </select>
    </div>
  );
}
function SummaryRow({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber";
  bold?: boolean;
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "amber"
        ? "text-amber-700"
        : "text-slate-900";
  return (
    <div className="flex items-center justify-between">
      <div className="text-slate-500">{label}</div>
      <div className={`${bold ? "font-semibold" : ""} ${color} tabular-nums`}>
        {value}
      </div>
    </div>
  );
}
