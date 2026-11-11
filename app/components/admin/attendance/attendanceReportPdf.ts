import type { AttendanceReport } from "@/lib/attendance-report";

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
    ["Paid", `${summary.paidHours} hrs`],
    ["Short", `${summary.shortHours} hrs`],
    ["Payable", `${summary.totalHours} hrs`],
  ];
  cards.forEach((card, index) => {
    const x = 12 + index * 55;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 28, 52, 16, 2, 2);
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

  const drawHead = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(12, y, widths.reduce((sum, width) => sum + width, 0), 7, "F");
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
    if (y > 190) {
      doc.addPage();
      header();
      y = 30;
      drawHead();
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
    }
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
    let x = 12;
    values.forEach((value, index) => {
      doc.text(String(value), x + 1.5, y + 4.5, { maxWidth: widths[index] - 3 });
      x += widths[index];
    });
    y += 6.5;
  });

  const safeName = input.employeeName.replace(/[^\w.-]+/g, "-");
  doc.save(`${safeName}-attendance.pdf`);
}
