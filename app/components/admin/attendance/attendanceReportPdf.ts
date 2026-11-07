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
    ["Paid leave & holidays", `${summary.paidHours} hrs`],
    ["Short", `${summary.shortHours} hrs`],
    ["Total payable", `${summary.totalHours} hrs`],
  ];
  cards.forEach((card, index) => {
    const x = 12 + index * 68;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 28, 64, 16, 2, 2);
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
  doc.text(
    `Monday–Saturday  ·  8 hours required  ·  Late days ${summary.lateDays}  ·  Leave ${summary.leaveDays}  ·  Holidays ${summary.holidayDays}  ·  Absent ${summary.absentDays}`,
    12,
    52
  );

  const columns = ["Date", "Day", "In", "Out", "Arrival", "Worked", "Short", "Paid", "Detail"];
  const widths = [24, 22, 24, 24, 24, 28, 28, 28, 68];
  let y = 58;

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
