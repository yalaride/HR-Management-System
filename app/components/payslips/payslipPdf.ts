import {
  parsePayslipLogoAdjust,
  PAYSLIP_LOGO_FRAME_MM,
  PAYSLIP_LOGO_PDF_RENDER_PX,
  renderAdjustedPayslipLogo,
} from "@/lib/payslipLogoAdjust";
export interface PayslipEmployee {
  _id?: string;
  name?: string;
  jobTitle?: string;
  profilePhotoUrl?: string;
  profilePhotoURL?: string;
  profilePhoto?: string;
  image?: string;
  picture?: string;
  profilePicture?: string;
  profilePic?: string;
}

export interface PayslipRecord {
  _id: string;
  employeeId?: PayslipEmployee | string | null;
  employeeName?: string;
  employeeRole?: string;
  period: string;
  basicSalary: number;
  allowances?: number;
  bonus?: number;
  deductions?: number;
  tax?: number;
  taxMode?: "deduct" | "add";
  netPay: number;
  paymentMethod?: string;
  paymentDate?: string;
  version?: string;
}

export interface PayslipCompanyDetails {
  companyName?: string;
  location?: string;
  email?: string;
  phone?: string;
  brandAccent?: string;
  brand_accent?: string;
  companyLogoUrl?: string;
  companyLogoScale?: number;
  companyLogoOffsetX?: number;
  companyLogoOffsetY?: number;
  payslipHeadName?: string;
  payslipHeadTitle?: string;
  payslipSignatureUrl?: string;
  payslipStampUrl?: string;
  [key: string]: unknown;
}

/** SyncUp theme tokens (matches app/globals.css) */
const THEME = {
  brandAccent: "#2563eb",
  brandHover: "#1d4ed8",
  brandSubtle: [219, 234, 254] as [number, number, number],
  contentMain: [15, 23, 42] as [number, number, number],
  contentSecondary: [71, 85, 105] as [number, number, number],
  contentMuted: [148, 163, 184] as [number, number, number],
  surfaceMain: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
};

const defaultFormatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    currencyDisplay: "symbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\u0024/g, "");

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = (hex || "").trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16),
      parseInt(cleaned[1] + cleaned[1], 16),
      parseInt(cleaned[2] + cleaned[2], 16),
    ];
  }
  if (cleaned.length === 6) {
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return [37, 99, 235];
}

/** Fetch a remote image and return a data-URL suitable for jsPDF.addImage. */
async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; format: string } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const mime = blob.type.toLowerCase();
    let format = "PNG";
    if (mime.includes("jpeg") || mime.includes("jpg")) format = "JPEG";
    else if (mime.includes("webp")) format = "WEBP";

    return { dataUrl, format };
  } catch {
    return null;
  }
}

function formatPaymentDate(value?: string): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Official payslip reference — shared by PDF, table, and admin search. */
export function getPayslipReferenceId(payslipId: string): string {
  const id = (payslipId || "").trim();
  if (!id) return "PAY-UNKNOWN";
  return `PAY-${id.slice(-8).toUpperCase()}`;
}

export function matchesPayslipReferenceSearch(payslipId: string, query: string): boolean {
  const q = query.trim().toUpperCase().replace(/\s/g, "");
  if (!q) return false;

  const ref = getPayslipReferenceId(payslipId).toUpperCase();
  const suffix = payslipId.slice(-8).toUpperCase();
  const qBare = q.replace(/^PAY-?/, "");

  return (
    ref.includes(q) ||
    suffix.includes(qBare) ||
    qBare.includes(suffix) ||
    payslipId.toUpperCase().includes(q)
  );
}

export function isPayslipReferenceQuery(query: string): boolean {
  const q = query.trim().toUpperCase().replace(/\s/g, "");
  if (!q) return false;
  if (q.startsWith("PAY")) return true;
  if (/^[A-F0-9]{4,24}$/i.test(q)) return true;
  return false;
}

type JsPdfDoc = import("jspdf").jsPDF;

function formatPdfAmount(
  formatCurrency: (amount: number) => string,
  amount: number,
  isDeduction = false
): string {
  const formatted = formatCurrency(Math.abs(amount)).replace(/\u0024/g, "").trim();
  return isDeduction ? `- ${formatted}` : formatted;
}

function drawClippedText(
  doc: JsPdfDoc,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: "left" | "right" | "center" = "left"
) {
  const lines = doc.splitTextToSize(text, maxWidth);
  const line = (Array.isArray(lines) ? lines[0] : lines) as string;
  doc.text(line, x, y, { align });
}

export async function downloadPayslipPdf({
  slip,
  employeeName,
  employeeRole,
  formatCurrency = defaultFormatCurrency,
  companyDetails,
}: {
  slip: PayslipRecord;
  employeeName: string;
  employeeRole: string;
  formatCurrency?: (amount: number) => string;
  companyDetails?: PayslipCompanyDetails | null;
}) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;

  const brandHex =
    companyDetails?.brandAccent || companyDetails?.brand_accent || THEME.brandAccent;
  const primary = hexToRgb(brandHex);
  const dark = THEME.contentMain;
  const gray = THEME.contentSecondary;
  const muted = THEME.contentMuted;
  const light = THEME.surfaceMain;
  const border = THEME.border;
  const white = THEME.white;
  const brandSubtle = THEME.brandSubtle;

  const companyName = companyDetails?.companyName?.trim() || "SyncUp HR";
  const companyAddress = companyDetails?.location?.trim() || "Office Headquarters, Pakistan";
  const companyEmail = companyDetails?.email?.trim() || "hr@mail.yalaride.com";
  const companyPhone = companyDetails?.phone?.trim() || "";
  const logoUrl = companyDetails?.companyLogoUrl?.trim() || "";
  const logoAdjust = parsePayslipLogoAdjust({
    scale: companyDetails?.companyLogoScale,
    offsetX: companyDetails?.companyLogoOffsetX,
    offsetY: companyDetails?.companyLogoOffsetY,
  });

  const refId = getPayslipReferenceId(slip._id);
  const paymentDate = formatPaymentDate(slip.paymentDate);
  const taxAmount = Math.max(0, slip.tax || 0);
  const taxIsAdded = slip.taxMode === "add" && taxAmount > 0;
  const taxIsDeducted = slip.taxMode !== "add" && taxAmount > 0;
  const grossEarnings =
    slip.basicSalary + (slip.allowances || 0) + (slip.bonus || 0) + (taxIsAdded ? taxAmount : 0);
  const grossDeductions = (slip.deductions || 0) + (taxIsDeducted ? taxAmount : 0);

  const logoImg = logoUrl ? await loadImageDataUrl(logoUrl) : null;
  const adjustedLogoDataUrl =
    logoUrl && logoImg
      ? await renderAdjustedPayslipLogo(
          logoUrl,
          logoAdjust,
          PAYSLIP_LOGO_PDF_RENDER_PX.width,
          PAYSLIP_LOGO_PDF_RENDER_PX.height
        )
      : null;

  // Header — light surface + brand accent stripe (SyncUp theme)
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageW, 5, "F");

  let y = 12;
  const headerLeftX = marginL;
  let headerTextY = y;

  if (logoImg) {
    try {
      const logoH = PAYSLIP_LOGO_FRAME_MM.height;
      const logoW = PAYSLIP_LOGO_FRAME_MM.width;
      const logoData = adjustedLogoDataUrl || logoImg.dataUrl;
      const logoFormat = adjustedLogoDataUrl ? "PNG" : logoImg.format;
      doc.addImage(logoData, logoFormat, headerLeftX, y - 4, logoW, logoH);
      headerTextY = y + logoH + 1;
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.text(companyName, headerLeftX, y);
      headerTextY = y + 6;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(companyName, headerLeftX, y);
    headerTextY = y + 6;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(companyAddress, headerLeftX, headerTextY);
  const contactLine = companyPhone ? `${companyEmail}  ·  ${companyPhone}` : companyEmail;
  doc.text(contactLine, headerLeftX, headerTextY + 4.5);

  doc.setFillColor(brandSubtle[0], brandSubtle[1], brandSubtle[2]);
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.35);
  doc.roundedRect(pageW - marginR - 48, y - 5, 48, 20, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text("SALARY SLIP", pageW - marginR - 24, y + 2, { align: "center" });
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("OFFICIAL DOCUMENT", pageW - marginR - 24, y + 7.5, { align: "center" });

  y = Math.max(headerTextY + 10, 34);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  // ── Meta cards (4 columns) ───────────────────────────────────────────────
  const metaItems = [
    { label: "Pay Period", value: slip.period },
    { label: "Payment Date", value: paymentDate },
    { label: "Reference No.", value: refId },
    { label: "Status", value: "PAID" },
  ];
  const cardGap = 3;
  const cardW = (contentW - cardGap * 3) / 4;
  const cardH = 16;

  metaItems.forEach((item, i) => {
    const x = marginL + i * (cardW + cardGap);
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, "FD");

    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(x, y, 1.2, cardH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(item.label.toUpperCase(), x + 4, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(i === 2 ? 7.5 : 9);
    doc.setTextColor(dark[0], dark[1], dark[2]);
    drawClippedText(doc, item.value, x + 4, y + 11.5, cardW - 6, "left");
  });

  y += cardH + 8;

  // ── Employee details card ────────────────────────────────────────────────
  const empCardH = 26;

  doc.setFillColor(white[0], white[1], white[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.roundedRect(marginL, y, contentW, empCardH, 2, 2, "S");
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.roundedRect(marginL, y, contentW, 7, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(white[0], white[1], white[2]);
  doc.text("EMPLOYEE INFORMATION", marginL + 4, y + 4.8);

  const empRowY = y + 13;
  const empValueY = empRowY + 5.5;
  const empColW = contentW / 4;
  const empFields = [
    { label: "Full Name", value: employeeName },
    { label: "Designation", value: employeeRole },
    { label: "Payment Method", value: slip.paymentMethod || "Bank Transfer" },
    { label: "Net Payable", value: formatPdfAmount(formatCurrency, slip.netPay), highlight: true },
  ];

  empFields.forEach((field, i) => {
    const x = marginL + 4 + i * empColW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(field.label.toUpperCase(), x, empRowY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    if (field.highlight) {
      doc.setTextColor(primary[0], primary[1], primary[2]);
    } else {
      doc.setTextColor(dark[0], dark[1], dark[2]);
    }
    drawClippedText(doc, field.value, x, empValueY, empColW - 6, "left");
  });

  y += empCardH + 8;

  // ── Earnings breakdown table ─────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text("SALARY BREAKDOWN", marginL, y);
  y += 4;

  const descColW = contentW * 0.46;
  const typeColX = marginL + descColW + 2;
  const amountColW = contentW * 0.34;
  const amountRightX = pageW - marginR - 3;

  const tableTop = y;
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.roundedRect(marginL, tableTop, contentW, 8, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(white[0], white[1], white[2]);
  doc.text("Description", marginL + 4, tableTop + 5.5);
  doc.text("Type", typeColX, tableTop + 5.5);
  drawClippedText(doc, "Amount (PKR)", amountRightX, tableTop + 5.5, amountColW, "right");

  type Row = { label: string; amount: number; type: "earning" | "deduction" };
  const rows: Row[] = [{ label: "Basic Salary", amount: slip.basicSalary, type: "earning" }];
  if ((slip.allowances || 0) > 0) {
    rows.push({ label: "Allowances", amount: slip.allowances || 0, type: "earning" });
  }
  if ((slip.bonus || 0) > 0) {
    rows.push({ label: "Bonus / Incentives", amount: slip.bonus || 0, type: "earning" });
  }
  if (taxIsAdded) {
    rows.push({ label: "Tax Added", amount: taxAmount, type: "earning" });
  }
  if ((slip.deductions || 0) > 0) {
    rows.push({
      label: "Other Deductions",
      amount: slip.deductions || 0,
      type: "deduction",
    });
  }
  if (taxIsDeducted) {
    rows.push({
      label: "Income Tax Deducted",
      amount: taxAmount,
      type: "deduction",
    });
  }

  let rowY = tableTop + 8;
  const rowH = 7.5;

  rows.forEach((row, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(light[0], light[1], light[2]);
      doc.rect(marginL, rowY, contentW, rowH, "F");
    }
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.1);
    doc.line(marginL, rowY + rowH, pageW - marginR, rowY + rowH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(dark[0], dark[1], dark[2]);
    drawClippedText(doc, row.label, marginL + 4, rowY + 5, descColW - 6, "left");

    const typeLabel = row.type === "deduction" ? "Deduction" : "Earning";
    const typeColor = row.type === "deduction" ? THEME.danger : THEME.success;
    doc.setFontSize(7);
    doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
    doc.text(typeLabel, typeColX, rowY + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
    drawClippedText(
      doc,
      formatPdfAmount(formatCurrency, row.amount, row.type === "deduction"),
      amountRightX,
      rowY + 5,
      amountColW,
      "right"
    );
    rowY += rowH;
  });

  doc.setFillColor(brandSubtle[0], brandSubtle[1], brandSubtle[2]);
  doc.rect(marginL, rowY, contentW, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text("Gross Earnings", marginL + 4, rowY + 5);
  drawClippedText(
    doc,
    formatPdfAmount(formatCurrency, grossEarnings),
    amountRightX,
    rowY + 5,
    amountColW,
    "right"
  );
  rowY += rowH;

  if (grossDeductions > 0) {
    doc.setFillColor(254, 242, 242);
    doc.rect(marginL, rowY, contentW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(THEME.danger[0], THEME.danger[1], THEME.danger[2]);
    doc.text("Total Deductions", marginL + 4, rowY + 5);
    drawClippedText(
      doc,
      formatPdfAmount(formatCurrency, grossDeductions, true),
      amountRightX,
      rowY + 5,
      amountColW,
      "right"
    );
    rowY += rowH;
  }

  rowY += 3;
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.roundedRect(marginL, rowY, contentW, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(white[0], white[1], white[2]);
  doc.text("NET TAKE-HOME PAY", marginL + 5, rowY + 9);
  doc.setFontSize(12);
  drawClippedText(
    doc,
    formatPdfAmount(formatCurrency, slip.netPay),
    amountRightX,
    rowY + 9.5,
    amountColW,
    "right"
  );

  rowY += 20;

  // Signatures — employee (left half) + authorized (right half), both white
  const authTop = rowY;
  const authH = 58;
  const halfW = (contentW - 6) / 2;
  const authGap = 6;

  const drawAuthBox = (x: number, title: string) => {
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, authTop, halfW, authH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(title, x + 4, authTop + 5.5);
  };

  drawAuthBox(marginL, "EMPLOYEE ACKNOWLEDGEMENT");

  const empBoxX = marginL + 4;
  const empBoxW = halfW - 8;
  const empBoxY = authTop + 10;
  const empBoxH = authH - 22;
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(empBoxX, empBoxY, empBoxW, empBoxH, 1, 1, "S");
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Employee Signature", empBoxX, authTop + authH - 6);
  doc.text("Date: _______________", empBoxX + empBoxW - 38, authTop + authH - 6);

  const authRightX = marginL + halfW + authGap;
  drawAuthBox(authRightX, "AUTHORIZED BY");

  const authInnerW = halfW - 8;
  const authInnerX = authRightX + 4;
  const sigBoxH = 14;
  const sigBoxY = authTop + 10;
  const stampBoxY = sigBoxY + sigBoxH + 3;
  const stampBoxH = authH - 12 - sigBoxH - 3;

  doc.setFillColor(white[0], white[1], white[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(authInnerX, sigBoxY, authInnerW, sigBoxH, 1, 1, "S");
  doc.roundedRect(authInnerX, stampBoxY, authInnerW, stampBoxH, 1, 1, "S");
  doc.setLineDashPattern([], 0);

  doc.setFontSize(6.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Head Signature", authInnerX + authInnerW / 2, sigBoxY + sigBoxH / 2 + 1, {
    align: "center",
  });
  doc.text("Company Stamp", authInnerX + authInnerW / 2, stampBoxY + stampBoxH / 2 + 1, {
    align: "center",
  });

  // ── Footer ───────────────────────────────────────────────────────────────
  const footerY = 282;
  doc.setFillColor(light[0], light[1], light[2]);
  doc.rect(marginL, footerY - 5, contentW, 14, "F");
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.line(marginL, footerY - 5, pageW - marginR, footerY - 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(
    "Official salary statement. Report discrepancies to HR within five (5) working days.",
    marginL + 2,
    footerY
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.text(`Ref: ${refId}`, marginL + 2, footerY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-GB")}  ·  ${companyName}`,
    marginL + 42,
    footerY + 4
  );

  const cleanFileName = `Payslip_${employeeName.replace(/\s+/g, "_")}_${slip.period.replace(/\s+/g, "_")}_${refId}.pdf`;
  doc.save(cleanFileName);
}
