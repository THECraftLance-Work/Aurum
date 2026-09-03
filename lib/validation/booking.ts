import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const optionalRule = <T extends z.ZodTypeAny>(rule: T) => z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  rule.optional(),
);

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().finite().nonnegative().optional(),
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a valid date").optional(),
);

const email = optionalRule(z.string().trim().email("must be a valid email address"));
const phone = optionalRule(z.string().trim().regex(/^[6-9]\d{9}$/, "must be a valid 10-digit Indian mobile number"));

export const customerSchema = z.object({
  title: optionalText,
  name: z.string().trim().min(1, "full name is required").max(120),
  relation_type: optionalText,
  father_spouse_name: optionalText,
  date_of_birth: optionalDate,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  country: optionalText,
  pin_code: optionalRule(z.string().trim().regex(/^[1-9]\d{5}$/, "must be a valid 6-digit PIN code")),
  phone,
  alternate_phone: phone,
  email,
  alternate_email: email,
  pan_number: optionalRule(z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "must be a valid PAN (for example ABCDE1234F)")),
  aadhaar_number: optionalRule(z.string().trim().regex(/^[2-9]\d{11}$/, "must be a valid 12-digit Aadhaar number")),
  occupation: optionalText,
  organization: optionalText,
  designation: optionalText,
}).superRefine((customer, ctx) => {
  if (customer.relation_type && !customer.father_spouse_name) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["father_spouse_name"], message: "is required when a relationship is selected" });
  }
  if (customer.date_of_birth && customer.date_of_birth > new Date().toISOString().slice(0, 10)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_of_birth"], message: "cannot be in the future" });
  }
  if (customer.phone && customer.alternate_phone && customer.phone === customer.alternate_phone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alternate_phone"], message: "must differ from phone" });
  }
});

const nonNegativeMoney = optionalNumber;

export const bookingSchema = z.object({
  project_name: z.string().trim().min(1, "project/property name is required").max(200),
  unit_number: z.string().trim().min(1, "unit/flat number is required").max(80),
  property_details: optionalText,
  total_property_value: z.preprocess((value) => Number(value), z.number().finite().positive("must be greater than zero")),
  previous_payments: nonNegativeMoney,
  current_payment: nonNegativeMoney,
  payment_date: optionalDate,
  payment_mode: z.enum(["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD", "OTHER"]),
  reference_no: optionalText,
  notes: optionalText,
  bank_name: optionalText,
  bank_account_holder: optionalText,
  bank_account_number: optionalRule(z.string().trim().regex(/^\d{9,18}$/, "must contain 9 to 18 digits")),
  bank_ifsc: optionalRule(z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "must be a valid 11-character IFSC")),
  bank_branch: optionalText,
  loan_sanctioned: z.enum(["yes", "no"]),
  loan_amount: nonNegativeMoney,
  sales_representative: optionalText,
  team_manager: optionalText,
  booking_place: optionalText,
  booking_date: optionalDate,
  block: optionalText,
  facing: optionalText,
  saleable_area: nonNegativeMoney,
  carpet_area: nonNegativeMoney,
  external_walls_area: nonNegativeMoney,
  balcony_utility_area: nonNegativeMoney,
  common_area: nonNegativeMoney,
  base_price: nonNegativeMoney,
  floor_rise_charges: nonNegativeMoney,
  east_facing_charges: nonNegativeMoney,
  premium_view_charges: nonNegativeMoney,
  amenities_charges: nonNegativeMoney,
  car_parking_charges: nonNegativeMoney,
  legal_documentation_charges: nonNegativeMoney,
  sale_consideration_per_sqft: nonNegativeMoney,
  source_of_booking: optionalText,
  referral_customer_name: optionalText,
  referral_project_name: optionalText,
  cp_agent_name: optionalText,
  cp_rera_id: optionalText,
  payment_source: optionalText,
  purchase_purpose: optionalText,
}).superRefine((booking, ctx) => {
  const previous = booking.previous_payments ?? 0;
  const current = booking.current_payment ?? 0;
  if (previous + current > booking.total_property_value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["current_payment"], message: "previous and current payments cannot exceed total property value" });
  }
  if (booking.loan_sanctioned === "yes" && !(booking.loan_amount && booking.loan_amount > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["loan_amount"], message: "is required when home loan is sanctioned" });
  }
});

export function validationMessage(result: z.SafeParseError<unknown>) {
  return result.error.issues
    .map((issue) => `${issue.path.join(".") || "Form"}: ${issue.message}`)
    .join("; ");
}
