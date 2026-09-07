"use client";
import { Pencil, Check, X } from "lucide-react";
import { useBookingEdit } from "./BookingEditProvider";

export default function HeaderEditControls() {
  const { editing, setEditing, save, cancel, busy } = useBookingEdit();
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="btn-secondary h-10">
        <Pencil className="h-4 w-4" /> Edit
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={cancel} disabled={busy} className="btn-secondary h-10">
        <X className="h-4 w-4" /> Cancel
      </button>
      <button type="button" onClick={save} disabled={busy} className="btn-primary h-10 min-w-[90px]">
        <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
