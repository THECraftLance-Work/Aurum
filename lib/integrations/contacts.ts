import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isEmail } from "./phone";

/**
 * One person who should be told about a booking.
 *
 * A booking is not "one customer" any more: `booking_customers` links a primary
 * buyer plus any co-buyers attached at creation time or later via the Attach
 * person action. Every one of them has an equal claim to hear about the
 * booking, so every customer-facing email fans out across this list rather
 * than going only to `bookings.customer_id`.
 */
export type BookingContact = {
  name: string;
  email: string;
  isPrimary: boolean;
};

/** Case-insensitive dedupe, primary first, only rows with a usable address. */
export function normalizeContacts(
  rows: { name?: string | null; email?: string | null; isPrimary?: boolean }[]
): BookingContact[] {
  const seen = new Set<string>();
  const out: BookingContact[] = [];
  // Primary first so that if the same address appears twice, the copy we keep
  // is the one flagged primary.
  const ordered = [...rows].sort((a, b) => Number(b.isPrimary ?? false) - Number(a.isPrimary ?? false));
  for (const r of ordered) {
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email || !isEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({
      name: String(r.name ?? "").trim() || "Customer",
      email,
      isPrimary: Boolean(r.isPrimary)
    });
  }
  return out;
}

/**
 * Every contactable person on a booking, primary buyer first.
 *
 * Reads with the service-role client: this runs inside route handlers that
 * have already authorised the actor, and `booking_customers` RLS is scoped to
 * the booking's creator, which would hide co-buyers from an accountant
 * approving someone else's payment.
 *
 * Falls back to `bookings.customer_id` when the junction table is empty — a
 * booking created before migration 0013 was applied still has to reach its
 * customer.
 */
export async function resolveBookingContacts(bookingUuid: string): Promise<BookingContact[]> {
  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from("booking_customers")
    .select("is_primary, customer:customer_id(name, email)")
    .eq("booking_id", bookingUuid)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (!error && data?.length) {
    const contacts = normalizeContacts(
      data.map((r: any) => {
        const c = Array.isArray(r.customer) ? r.customer[0] : r.customer;
        return { name: c?.name, email: c?.email, isPrimary: Boolean(r.is_primary) };
      })
    );
    if (contacts.length) return contacts;
  }

  const { data: bk } = await admin
    .from("bookings")
    .select("customer:customer_id(name, email)")
    .eq("id", bookingUuid)
    .maybeSingle();
  const c: any = Array.isArray((bk as any)?.customer) ? (bk as any).customer[0] : (bk as any)?.customer;
  return normalizeContacts([{ name: c?.name, email: c?.email, isPrimary: true }]);
}
