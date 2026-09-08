"use client";
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { buildBookingStatementPdf } from "@/lib/integrations/pdf";
import { formatDate } from "@/lib/utils/format";

type Props = {
  bookingRef: string;
  project: string;
  subProjectName?: string;
  unit: string;
  sft?: string | number;
  bookingDate?: string | null;
  customerName: string;
  coApplicantName?: string | null;
  totalValue: number;
  totalPaid: number;
  remaining: number;
  receipts: { no: string; date: string; mode: string; amount: number; ref?: string; bankName?: string; instrumentDate?: string; instrumentNo?: string }[];
};

export default function BookingStatementPdfButton({ bookingRef, project, subProjectName, unit, sft, bookingDate, customerName, coApplicantName, totalValue, totalPaid, remaining, receipts }: Props) {
  const [busy, setBusy] = useState(false);
  async function handleDownload() {
    try {
      setBusy(true);
      const bytes = await buildBookingStatementPdf({
        bookingRef,
        project,
        subProjectName,
        unit,
        sft,
        bookingDate,
        customerName,
        coApplicantName,
        totalValue,
        totalPaid,
        remaining,
        receipts,
      });
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const brand = project.toLowerCase().includes("aurum") ? "AURUM" : project.toLowerCase().includes("tatva") ? "TATVA" : project.replace(/\s+/g, "_").toUpperCase();
      a.download = `${brand}_Statement_${bookingRef}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to generate PDF");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={handleDownload}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
      title="Download Statement of Accounts as PDF"
    >
      {busy ? <FileText className="h-3.5 w-3.5 animate-pulse" /> : <Download className="h-3.5 w-3.5" />}
      {busy ? "Preparing..." : "Statement PDF"}
    </button>
  );
}
