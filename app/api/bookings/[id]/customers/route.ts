import { NextResponse } from "next/server";

/**
 * Co-buyers must be supplied during booking creation. Allowing this endpoint
 * after creation made the booking's customer and email audience mutable.
 */
export async function POST() {
  return NextResponse.json(
    { error: "People cannot be attached after a booking is created." },
    { status: 410 },
  );
}
