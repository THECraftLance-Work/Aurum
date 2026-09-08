import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type BookingStatementData = {
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
  // Optional pre-computed charge splits – if not provided we derive from totals
  totalBaseReceivable?: number;
  totalBaseReceived?: number;
  totalBaseOutstanding?: number;
  totalOtherReceivable?: number;
  totalOtherReceived?: number;
  totalOtherOutstanding?: number;
  receipts: {
    no: string;
    date: string;
    mode: string;
    bankName?: string;
    instrumentDate?: string;
    instrumentNo?: string;
    amount: number;
    ref?: string;
  }[];
};

function money(n: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function moneyRs(n: number) {
  return "Rs. " + money(n);
}
function sanitize(v: string) {
  return String(v ?? "").replace(/\n/g, " ").trim() || "-";
}

export async function buildBookingStatementPdf(d: BookingStatementData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const margin = 18;
  const contentW = width - margin * 2;
  let y = height - margin; // top

  const col = {
    black: rgb(0, 0, 0),
    dark: rgb(0.12, 0.12, 0.12),
    gray: rgb(0.35, 0.35, 0.35),
    light: rgb(0.92, 0.92, 0.92),
    border: rgb(0.65, 0.65, 0.65),
    borderLight: rgb(0.75, 0.75, 0.75),
  };

  const drawText = (text: string, x: number, yPos: number, size = 7, f = font, color = col.dark, opts: { maxWidth?: number } = {}) => {
    let t = String(text ?? "");
    if (opts.maxWidth) {
      // naive truncate to fit – pdf-lib has no wrapping, so trim
      const maxChars = Math.floor(opts.maxWidth / (size * 0.55));
      if (t.length > maxChars) t = t.slice(0, maxChars - 1) + "…";
    }
    page.drawText(t, { x, y: yPos, size, font: f, color });
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, thickness = 0.5) => {
    page.drawLine({ start: { x, y: yPos }, end: { x: x + w, y: yPos }, thickness, color: col.border });
    page.drawLine({ start: { x, y: yPos - h }, end: { x: x + w, y: yPos - h }, thickness, color: col.border });
    page.drawLine({ start: { x, y: yPos }, end: { x, y: yPos - h }, thickness, color: col.border });
    page.drawLine({ start: { x: x + w, y: yPos }, end: { x: x + w, y: yPos - h }, thickness, color: col.border });
  };

  // ── Brand header ──
  // Project-specific brand: if booking is Aurum/Tatva we show that, else Rajapushpa (reference)
  const lower = d.project.toLowerCase();
  const brandCompany = lower.includes("aurum")
    ? "AURUM"
    : lower.includes("tatva")
      ? "TATVA"
      : lower.includes("rajapushpa")
        ? "Rajapushpa Properties Pvt. Ltd."
        : d.project; // fallback to actual project name
  const isRajapushpa = brandCompany.includes("Rajapushpa");

  // Top bar: Logo placeholder + company name center + Dated right
  // Logo: draw a small red emblem approximation (just a red rect + white text if needed)
  // For Aurum/Tatva we use plain text centered; for Rajapushpa we mimic the screenshot layout
  if (isRajapushpa) {
    // Emulate the red lotus logo – just a red square with text RP
    const logoW = 38, logoH = 26;
    const lx = margin;
    const ly = y;
    page.drawRectangle({ x: lx, y: ly - logoH, width: logoW, height: logoH, color: rgb(0.78, 0.05, 0.05) });
    drawText("RP", lx + 12, ly - 17, 9, bold, rgb(1, 1, 1));
    drawText("RAJAPUSHPA", lx, ly - 34, 8, bold);
    drawText("PROPERTIES PVT. LTD.", lx, ly - 40, 4.5, font, col.gray);
    drawText("Shaping Innovations", lx, ly - 45, 4, fontOblique, col.gray);
  } else {
    drawText(brandCompany, margin, y - 6, 9, bold);
    drawText("Shaping Innovations", margin, y - 13, 4, fontOblique, col.gray);
  }

  // Company subtitle centered
  drawText(isRajapushpa ? "Rajapushpa Properties Pvt. Ltd." : brandCompany, width / 2 - 70, y - 12, 7, font);
  // Statement title centered bold
  drawText("STATEMENT OF ACCOUNTS", width / 2 - 45, y - 24, 7.5, bold);
  y -= 36;
  // Dated right aligned
  const datedStr = `Dated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  drawText(datedStr, width - margin - 90, y + 36 - 2, 6, font, col.dark);

  // ── Meta info bordered table (6 rows) ──
  const metaRows: [string, string][] = [
    ["Project Name:", sanitize(d.project)],
    ["Sub Project Name:", sanitize(d.subProjectName ?? (d as any).block ? `BLOCK ${(d as any).block}` : "—")],
    ["Unit No:", `${sanitize(d.unit)}, Sft:${sanitize(String(d.sft ?? "")) || "-"}, Booking Date:${d.bookingDate ? new Date(d.bookingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}`],
    ["Customer Name:", sanitize(d.customerName)],
    ["Co-Applicant Name:", sanitize(d.coApplicantName ?? "—")],
  ];
  const metaLabelW = 110;
  const metaValW = contentW - metaLabelW;
  const metaRowH = 13;
  const metaStartY = y;
  // Outer border
  const metaTotalRows = metaRows.length + 1; // + TOTAL COST row
  const metaH = metaRowH * metaTotalRows;
  drawRect(margin, metaStartY, contentW, metaH);

  // Horizontal lines + vertical divider
  for (let i = 1; i < metaTotalRows; i++) {
    const yy = metaStartY - i * metaRowH;
    page.drawLine({ start: { x: margin, y: yy }, end: { x: margin + contentW, y: yy }, thickness: 0.35, color: col.borderLight });
  }
  // Vertical divider for first 5 rows
  for (let i = 0; i < 5; i++) {
    const yy = metaStartY - i * metaRowH;
    page.drawLine({ start: { x: margin + metaLabelW, y: yy - metaRowH }, end: { x: margin + metaLabelW, y: yy }, thickness: 0.35, color: col.borderLight });
  }
  // Meta row texts
  metaRows.forEach(([k, v], i) => {
    const yy = metaStartY - i * metaRowH - 8.5;
    drawText(k, margin + 4, yy, 6, font, col.dark, { maxWidth: metaLabelW - 8 });
    drawText(v, margin + metaLabelW + 4, yy, 6, bold, col.dark, { maxWidth: metaValW - 8 });
  });
  // TOTAL COST row – two columns, value right-bold
  const costY = metaStartY - 5 * metaRowH - 8.5;
  drawText("TOTAL COST OF THE APARTMENT", margin + 4, costY, 6, bold);
  const costVal = money(d.totalValue);
  const costValW = bold.widthOfTextAtSize(costVal, 6.5);
  drawText(costVal, margin + contentW - costValW - 4, costY, 6.5, bold);
  y = metaStartY - metaH - 6;

  // Receipt Details title
  drawText("Receipt Details", width / 2 - 28, y, 7, bold);
  y -= 10;
  // Receipt table
  const receiptColHeaders = ["Receipt No. /\nReceipt ID", "Date of\nReceipt", "Mode Of\nPayment", "Bank Name", "Instrument\nDate", "Instrument No.", "Amount\nReceived"];
  const receiptColWidths = [70, 56, 62, 58, 56, 120, 70]; // sum = 492, fits contentW 559 with margins
  const receiptColX: number[] = [];
  let cx = margin;
  receiptColWidths.forEach((w) => { receiptColX.push(cx); cx += w; });
  const receiptHeaderH = 22;
  const receiptRowH = 14;
  const receiptHeaderY = y;

  // Header background
  page.drawRectangle({ x: margin, y: receiptHeaderY - receiptHeaderH, width: contentW, height: receiptHeaderH, color: rgb(0.96, 0.96, 0.96) });
  // Header outer border
  drawRect(margin, receiptHeaderY, contentW, receiptHeaderH);
  // Vertical dividers + header text (multi-line)
  receiptColX.forEach((x, i) => {
    if (i > 0) page.drawLine({ start: { x, y: receiptHeaderY }, end: { x, y: receiptHeaderY - receiptHeaderH }, thickness: 0.35, color: col.borderLight });
    const hdr = receiptColHeaders[i];
    const lines = hdr.split("\n");
    lines.forEach((line, li) => {
      const tw = font.widthOfTextAtSize(line, 5.2);
      const colW = receiptColWidths[i];
      const tx = x + (colW - tw) / 2;
      const ty = receiptHeaderY - 7 - li * 6.5;
      drawText(line, tx, ty, 5.2, bold);
    });
  });
  y = receiptHeaderY - receiptHeaderH;

  // Receipt rows
  const receiptsToShow = d.receipts.length ? d.receipts : [];
  let totalDrawn = 0;
  const drawReceiptRow = (r: any, yy: number) => {
    // Row border
    page.drawLine({ start: { x: margin, y: yy - receiptRowH }, end: { x: margin + contentW, y: yy - receiptRowH }, thickness: 0.25, color: col.borderLight });
    receiptColX.forEach((x, i) => {
      if (i > 0) page.drawLine({ start: { x, y: yy }, end: { x, y: yy - receiptRowH }, thickness: 0.25, color: col.borderLight });
    });
    const cells = [
      r.no ?? r.receiptNo ?? "-",
      r.date ?? "-",
      (r.mode ?? "-").replaceAll("_", " "),
      r.bankName ?? r.mode ?? "Online Payment",
      r.instrumentDate ?? r.date ?? "-",
      r.instrumentNo ?? r.ref ?? "BY TRANSFER-RTGS UTR NO: -",
      money(r.amount ?? 0),
    ];
    cells.forEach((cell, i) => {
      const isAmount = i === 6;
      let txt = String(cell);
      if (txt.length > 28 && i === 5) txt = txt.slice(0, 26) + "…";
      else if (txt.length > 18 && i !== 5) txt = txt.slice(0, 16) + "…";
      const size = 5.2;
      const colW = receiptColWidths[i];
      if (isAmount) {
        const tw = font.widthOfTextAtSize(txt, size);
        drawText(txt, receiptColX[i] + colW - tw - 4, yy - 9, size, font);
      } else {
        // center small cols, left for instrument no
        if (i === 5) drawText(txt, receiptColX[i] + 3, yy - 9, 4.8, font, col.dark, { maxWidth: colW - 6 });
        else {
          const tw = font.widthOfTextAtSize(txt, size);
          drawText(txt, receiptColX[i] + (colW - tw) / 2, yy - 9, size, font);
        }
      }
    });
  };

  // Draw rows with pagination check
  let currentPage = page;
  let currentY = y;
  const ensureSpace = (needed: number) => {
    if (currentY - needed < margin + 30) {
      const np = pdf.addPage([595.28, 841.89]);
      // copy width/height but we keep same margin logic
      (currentPage as any) = np;
      // monkey patch page reference for subsequent draws – easier to create new helpers that target np
      // Instead we switch `page` variable via closure: reassign outer page reference
      (page as any).drawText = (t: any) => np.drawText(t.text ?? t, t);
      return np;
    }
    return currentPage;
  };

  // Since we captured page in closures, easiest is to just keep drawing on original page and if overflow create new page and reset y
  // We'll implement simple: if overflow, add new page and reset y, and re-draw header on new page
  let activePage: any = page;
  const drawOn = (fn: (p: any) => void, targetPage: any) => {
    // helper to temporarily swap global page reference
    const prev = (globalThis as any)._activePage ?? page;
    (globalThis as any)._activePage = targetPage;
    fn(targetPage);
  };

  // Simpler: just handle without complex – if receipts > 14, split
  for (let idx = 0; idx < receiptsToShow.length; idx++) {
    if (currentY - receiptRowH < 70) {
      // new page
      activePage = pdf.addPage([595.28, 841.89]);
      currentY = height - margin;
      // Re-draw receipt header continuation
      const nhy = currentY;
      activePage.drawRectangle({ x: margin, y: nhy - receiptHeaderH, width: contentW, height: receiptHeaderH, color: rgb(0.96, 0.96, 0.96) });
      drawRect.call({} as any, margin, nhy, contentW, receiptHeaderH); // but drawRect uses outer page, so we need manual
      // quick manual header redraw on new page
      activePage.drawLine({ start: { x: margin, y: nhy - receiptHeaderH }, end: { x: margin + contentW, y: nhy - receiptHeaderH }, thickness: 0.5, color: col.border });
      receiptColX.forEach((x, i) => {
        if (i > 0) activePage.drawLine({ start: { x, y: nhy }, end: { x, y: nhy - receiptHeaderH }, thickness: 0.35, color: col.borderLight });
        const hdr = receiptColHeaders[i];
        const lines = hdr.split("\n");
        lines.forEach((line, li) => {
          const tw = font.widthOfTextAtSize(line, 5.2);
          const colW = receiptColWidths[i];
          const tx = x + (colW - tw) / 2;
          const ty = nhy - 7 - li * 6.5;
          activePage.drawText(line, { x: tx, y: ty, size: 5.2, font: bold, color: col.dark });
        });
      });
      currentY = nhy - receiptHeaderH;
    }
    const rowY = currentY;
    // draw row on activePage
    activePage.drawLine({ start: { x: margin, y: rowY - receiptRowH }, end: { x: margin + contentW, y: rowY - receiptRowH }, thickness: 0.25, color: col.borderLight });
    receiptColX.forEach((x, i) => {
      if (i > 0) activePage.drawLine({ start: { x, y: rowY }, end: { x, y: rowY - receiptRowH }, thickness: 0.25, color: col.borderLight });
    });
    // outer left/right borders for row
    activePage.drawLine({ start: { x: margin, y: rowY }, end: { x: margin, y: rowY - receiptRowH }, thickness: 0.35, color: col.border });
    activePage.drawLine({ start: { x: margin + contentW, y: rowY }, end: { x: margin + contentW, y: rowY - receiptRowH }, thickness: 0.35, color: col.border });
    const r = receiptsToShow[idx];
    const cells = [
      r.no ?? "-",
      r.date ?? "-",
      (r.mode ?? "-").replaceAll("_", " "),
      r.bankName ?? "Online Payment",
      r.instrumentDate ?? r.date ?? "-",
      r.instrumentNo ?? r.ref ?? "BY TRANSFER-RTGS UTR NO: HD",
      money(r.amount ?? 0),
    ];
    cells.forEach((cell, i) => {
      const isAmount = i === 6;
      let txt = String(cell);
      if (txt.length > 32 && i === 5) txt = txt.slice(0, 30) + "…";
      const size = 5;
      const colW = receiptColWidths[i];
      if (isAmount) {
        const tw = font.widthOfTextAtSize(txt, size);
        activePage.drawText(txt, { x: receiptColX[i] + colW - tw - 4, y: rowY - 8.5, size, font, color: col.dark });
      } else if (i === 5) {
        activePage.drawText(txt.slice(0, 42), { x: receiptColX[i] + 2, y: rowY - 8.5, size: 4.6, font, color: col.dark });
      } else {
        const tw = font.widthOfTextAtSize(txt, size);
        activePage.drawText(txt, { x: receiptColX[i] + (colW - tw) / 2, y: rowY - 8.5, size, font, color: col.dark });
      }
    });
    currentY -= receiptRowH;
  }

  // If no receipts, show empty row
  if (receiptsToShow.length === 0) {
    activePage.drawLine({ start: { x: margin, y: currentY - receiptRowH }, end: { x: margin + contentW, y: currentY - receiptRowH }, thickness: 0.25, color: col.borderLight });
    receiptColX.forEach((x, i) => {
      if (i > 0) activePage.drawLine({ start: { x, y: currentY }, end: { x, y: currentY - receiptRowH }, thickness: 0.25, color: col.borderLight });
    });
    activePage.drawText("No receipts yet", { x: width / 2 - 22, y: currentY - 9, size: 6, font, color: col.gray });
    currentY -= receiptRowH;
  }

  // Total Amount Received row – spans first 6 cols
  const totalRowY = currentY;
  activePage.drawRectangle({ x: margin, y: totalRowY - receiptRowH, width: contentW, height: receiptRowH, color: rgb(0.98, 0.98, 0.98) });
  activePage.drawLine({ start: { x: margin, y: totalRowY }, end: { x: margin + contentW, y: totalRowY }, thickness: 0.5, color: col.border });
  activePage.drawLine({ start: { x: margin, y: totalRowY - receiptRowH }, end: { x: margin + contentW, y: totalRowY - receiptRowH }, thickness: 0.5, color: col.border });
  activePage.drawLine({ start: { x: margin, y: totalRowY }, end: { x: margin, y: totalRowY - receiptRowH }, thickness: 0.5, color: col.border });
  activePage.drawLine({ start: { x: margin + contentW, y: totalRowY }, end: { x: margin + contentW, y: totalRowY - receiptRowH }, thickness: 0.5, color: col.border });
  // vertical before amount
  activePage.drawLine({ start: { x: receiptColX[6], y: totalRowY }, end: { x: receiptColX[6], y: totalRowY - receiptRowH }, thickness: 0.5, color: col.border });
  const totalLabel = "Total Amount Received";
  const tlw = bold.widthOfTextAtSize(totalLabel, 6);
  activePage.drawText(totalLabel, { x: receiptColX[5] - tlw - 8, y: totalRowY - 9, size: 6, font: bold, color: col.dark });
  const totalVal = money(d.totalPaid ?? 0);
  const tvw = bold.widthOfTextAtSize(totalVal, 6);
  activePage.drawText(totalVal, { x: receiptColX[6] + receiptColWidths[6] - tvw - 4, y: totalRowY - 9, size: 6, font: bold, color: col.dark });
  currentY = totalRowY - receiptRowH - 8;

  // ── BRIEF RECEIVED DETAILS ──
  activePage.drawText("BREIF RECEIVED DETAILS", { x: width / 2 - 45, y: currentY, size: 6.5, font: bold, color: col.dark });
  currentY -= 10;
  const briefHeaders = ["Charge Type", "Total Amount Receivable", "Total Amount Received", "Total Outstanding"];
  const briefWidths = [contentW * 0.38, contentW * 0.20, contentW * 0.21, contentW * 0.21];
  const briefX: number[] = [];
  let bx = margin;
  briefWidths.forEach((w) => { briefX.push(bx); bx += w; });
  const briefHeadH = 14;
  const briefRowH = 12;
  // header bg
  activePage.drawRectangle({ x: margin, y: currentY - briefHeadH, width: contentW, height: briefHeadH, color: rgb(0.96, 0.96, 0.96) });
  drawRect.call({}, margin, currentY, contentW, briefHeadH);
  // draw header using manual on activePage
  activePage.drawLine({ start: { x: margin, y: currentY }, end: { x: margin + contentW, y: currentY }, thickness: 0.5, color: col.border });
  activePage.drawLine({ start: { x: margin, y: currentY - briefHeadH }, end: { x: margin + contentW, y: currentY - briefHeadH }, thickness: 0.5, color: col.border });
  briefHeaders.forEach((h, i) => {
    if (i > 0) activePage.drawLine({ start: { x: briefX[i], y: currentY }, end: { x: briefX[i], y: currentY - briefHeadH }, thickness: 0.35, color: col.borderLight });
    const tw = bold.widthOfTextAtSize(h, 5);
    const tx = i === 0 ? briefX[i] + 6 : briefX[i] + (briefWidths[i] - tw) / 2;
    activePage.drawText(h, { x: tx, y: currentY - 8.5, size: 5, font: bold, color: col.dark });
  });
  currentY -= briefHeadH;
  // Compute charge splits
  const baseRec = d.totalBaseReceivable ?? Math.round(d.totalValue * 0.952);
  const otherRec = d.totalOtherReceivable ?? (d.totalValue - baseRec);
  const baseRem = d.totalBaseReceived ?? Math.round(d.totalPaid * 0.952);
  const otherRem = d.totalOtherReceived ?? (d.totalPaid - baseRem);
  const baseOut = d.totalBaseOutstanding ?? (baseRec - baseRem);
  const otherOut = d.totalOtherOutstanding ?? (otherRec - otherRem);

  const briefRows = [
    ["TOTAL BASE AMOUNT", money(baseRec), money(baseRem), money(baseOut)],
    ["TOTAL OTHER CHARGES AMOUNT INC TAX", money(otherRec), money(otherRem), money(otherOut)],
  ];
  briefRows.forEach((row) => {
    activePage.drawLine({ start: { x: margin, y: currentY - briefRowH }, end: { x: margin + contentW, y: currentY - briefRowH }, thickness: 0.25, color: col.borderLight });
    briefX.forEach((x, i) => { if (i > 0) activePage.drawLine({ start: { x, y: currentY }, end: { x, y: currentY - briefRowH }, thickness: 0.25, color: col.borderLight }); });
    activePage.drawLine({ start: { x: margin, y: currentY }, end: { x: margin, y: currentY - briefRowH }, thickness: 0.35, color: col.border });
    activePage.drawLine({ start: { x: margin + contentW, y: currentY }, end: { x: margin + contentW, y: currentY - briefRowH }, thickness: 0.35, color: col.border });
    row.forEach((cell, i) => {
      const size = 5;
      const isFirst = i === 0;
      const tx = isFirst ? briefX[i] + 6 : briefX[i] + briefWidths[i] - font.widthOfTextAtSize(cell, size) - 6;
      const f = isFirst ? bold : font;
      activePage.drawText(cell, { x: tx, y: currentY - 8, size, font: f, color: col.dark });
    });
    currentY -= briefRowH;
  });

  currentY -= 6;
  const footerLines = [
    `Total Amount Received: ${moneyRs(d.totalPaid)}`,
    `Total Amount Received including Excess Amount and Credit Notes: ${moneyRs(d.totalPaid)}`,
    ``,
    `Total Outstanding As on Date (Scheduled Due-Received Amount): ${moneyRs(d.remaining)}`,
    `Balance Payment (Flat Cost-Received Amount): ${moneyRs(d.remaining)}`,
    `Excess Amount :${moneyRs(0)}`,
  ];
  footerLines.forEach((line) => {
    if (!line) { currentY -= 6; return; }
    activePage.drawText(line, { x: margin, y: currentY, size: 6, font: line.startsWith("Total Outstanding") || line.startsWith("Balance") ? bold : font, color: col.dark });
    currentY -= 9;
  });

  // Footer note
  activePage.drawText("This is a computer-generated statement. No signature required.", { x: width / 2 - 85, y: margin - 2, size: 5, font: fontOblique, color: rgb(0.5, 0.5, 0.5) });

  return pdf.save();
}
