"use client";
import { useRouter, useSearchParams } from "next/navigation";

export default function BookingFilter({
  bookings,
  current,
}: {
  bookings: { id: string; booking_id: string }[];
  current?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    const params = new URLSearchParams(sp.toString());
    if (v) params.set("booking", v);
    else params.delete("booking");
    params.delete("page");
    router.push(`/payments?${params.toString()}`);
  }
  return (
    <div className="flex items-center gap-2">
      <select
        value={current ?? ""}
        onChange={onChange}
        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs"
      >
        <option value="">All bookings</option>
        {bookings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.booking_id}
          </option>
        ))}
      </select>
    </div>
  );
}
