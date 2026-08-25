import { requireRole } from "@/lib/auth/session";
import NewBookingForm from "@/components/bookings/NewBookingForm";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  const user = await requireRole(["SM","CP","ADMIN","DIRECTOR"]);
  return (
    <>
      <PageHeader
        title="New booking"
        description="Capture customer, property, and initial payment. The Booking ID is generated automatically on submit."
      />
      <NewBookingForm role={user.role} />
    </>
  );
}
