// "use client";
// import { useState } from "react";
// import { UserPlus, X } from "lucide-react";

// export default function AddBookingCustomer({ bookingId }: { bookingId: string }) {
//   const [open, setOpen] = useState(false);
//   const [form, setForm] = useState({ name: "", phone: "", email: "" });
//   const [busy, setBusy] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   async function submit(e: React.FormEvent) {
//     e.preventDefault();
//     if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
//       setError("All fields are required.");
//       return;
//     }
//     setBusy(true);
//     setError(null);
//     const res = await fetch(`/api/bookings/${bookingId}/customers`, {
//       method: "POST",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify(form),
//     });
//     setBusy(false);
//     if (!res.ok) {
//       const body = await res.json().catch(() => ({}));
//       setError(body.error ?? "Could not attach customer.");
//       return;
//     }
//     window.location.reload();
//   }

//   if (!open)
//     return (
//       <button
//         type="button"
//         className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
//         onClick={() => setOpen(true)}
//       >
//         <UserPlus className="h-3.5 w-3.5" />
//         Attach person
//       </button>
//     );

//   return (
//     <form
//       onSubmit={submit}
//       className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
//     >
//       <div className="mb-3 flex items-center justify-between">
//         <h4 className="text-sm font-semibold text-slate-900">Attach person</h4>
//         <button
//           type="button"
//           onClick={() => setOpen(false)}
//           className="grid h-7 w-7 place-items-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
//           aria-label="Close"
//         >
//           <X className="h-3.5 w-3.5" />
//         </button>
//       </div>

//       <div className="grid gap-3 sm:grid-cols-3">
//         <label className="block">
//           <span className="mb-1 block text-xs font-medium text-slate-700">
//             Full name <span className="text-rose-600">*</span>
//           </span>
//           <input
//             className="input bg-white"
//             required
//             placeholder="e.g. Priya Sharma"
//             value={form.name}
//             onChange={(e) => setForm({ ...form, name: e.target.value })}
//           />
//         </label>
//         <label className="block">
//           <span className="mb-1 block text-xs font-medium text-slate-700">
//             Phone <span className="text-rose-600">*</span>
//           </span>
//           <input
//             className="input bg-white"
//             required
//             placeholder="10-digit mobile"
//             value={form.phone}
//             onChange={(e) => setForm({ ...form, phone: e.target.value })}
//           />
//         </label>
//         <label className="block">
//           <span className="mb-1 block text-xs font-medium text-slate-700">
//             Email <span className="text-rose-600">*</span>
//           </span>
//           <input
//             className="input bg-white"
//             type="email"
//             required
//             placeholder="name@email.com"
//             value={form.email}
//             onChange={(e) => setForm({ ...form, email: e.target.value })}
//           />
//         </label>
//       </div>

//       {error && (
//         <p className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700">
//           {error}
//         </p>
//       )}

//       <div className="mt-4 flex gap-2">
//         <button disabled={busy} className="btn-primary h-9 px-5 text-xs">
//           {busy ? "Attaching…" : "Attach person"}
//         </button>
//         <button
//           type="button"
//           className="btn-secondary h-9 px-5 text-xs"
//           onClick={() => setOpen(false)}
//         >
//           Cancel
//         </button>
//       </div>
//     </form>
//   );
// }
