import type { AttendanceReport } from "@/lib/attendance-report";
import { formatMinutes } from "@/lib/attendance-report";

interface AttendancePdfInput {
  employeeName: string;
  designation: string;
  department: string;
  periodLabel: string;
  report: AttendanceReport;
}

export async function downloadAttendanceReport(input: AttendancePdfInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const { summary } = input.report;

  const header = () => {
    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Sync Up Attendance Report", 12, 10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${input.employeeName}  ·  ${input.designation}  ·  ${input.department}`, 12, 16);
    doc.text(input.periodLabel, pageWidth - 12, 16, { align: "right" });
  };

  header();
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  const cards = [
    ["Attended", `${summary.attendedHours} hrs`],
    ["Extra", `${summary.extraHours} hrs`],
    ["Holiday", `${summary.holidayHours} hrs`],
    ["Leave", `${summary.leaveHours} hrs`],
    ["Short", formatMinutes(Math.round(summary.shortHours * 60))],
    ["Payable", `${summary.totalHours} hrs`],
  ];
  cards.forEach((card, index) => {
    const x = 12 + index * 46;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 28, 43, 16, 2, 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(card[0], x + 3, 34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(card[1], x + 3, 40);
  });

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const note = `Extra used to cover short days: ${summary.extraUsedHours} hrs. Monthly leave used: ${summary.leaveCoverHours} hrs of 20. ${summary.coverNote}`;
  const noteLines = doc.splitTextToSize(note, pageWidth - 24);
  doc.text(noteLines, 12, 50);

  const columns = ["Date", "Day", "In", "Out", "Arrival", "Worked", "Extra", "Short", "Paid", "Detail"];
  const widths = [22, 18, 22, 22, 22, 24, 22, 22, 22, 72];
  let y = 52 + noteLines.length * 4;

  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  const drawHead = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(12, y, tableWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    let x = 12;
    columns.forEach((label, index) => {
      doc.text(label, x + 1.5, y + 4.5);
      x += widths[index];
    });
    y += 7;
  };

  drawHead();
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);

  input.report.days.forEach((row) => {
    const values = [
      row.date,
      row.weekday,
      row.checkIn,
      row.checkOut,
      row.arrival,
      row.worked,
      row.extra,
      row.short,
      row.paid,
      row.detail,
    ];
    const detailWidth = widths[widths.length - 1] - 3;
    const detailLines = doc.splitTextToSize(String(row.detail || "—"), detailWidth);
    const lineHeight = 3.4;
    const rowHeight = Math.max(6.5, detailLines.length * lineHeight + 2.4);
    if (y + rowHeight > 192) {
      doc.addPage();
      header();
      y = 30;
      drawHead();
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
    }
    if (row.arrival === "Holiday") doc.setFillColor(224, 242, 254);
    else if (row.arrival === "Paid leave") doc.setFillColor(237, 233, 254);
    else if (row.arrival === "Absent" || row.arrival === "Unpaid leave") doc.setFillColor(255, 228, 230);
    else doc.setFillColor(255, 255, 255);
    doc.rect(12, y, tableWidth, rowHeight, "F");
    doc.setTextColor(15, 23, 42);
    let x = 12;
    values.slice(0, -1).forEach((value, index) => {
      doc.text(String(value), x + 1.5, y + 4.5, { maxWidth: widths[index] - 3 });
      x += widths[index];
    });
    doc.text(detailLines, x + 1.5, y + 4.2);
    y += rowHeight;
  });

  const safeName = input.employeeName.replace(/[^\w.-]+/g, "-");
  doc.save(`${safeName}-attendance.pdf`);
}
