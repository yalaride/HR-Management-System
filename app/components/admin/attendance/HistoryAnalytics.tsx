"use client";

import React, { useEffect, useState, useRef } from "react";
import { TrendingUp, ChevronDown, Lock, Edit2, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import RetroLogModal from "./RetroLogModal";
import { downloadAttendanceReport } from "./attendanceReportPdf";
import type { AttendanceReport } from "@/lib/attendance-report";

function karachiMonthLabel(offsetMonths: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  let year = Number(parts.find((part) => part.type === "year")?.value);
  let month = Number(parts.find((part) => part.type === "month")?.value) + offsetMonths;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface Employee {
  id: string;
  userId: string;
  name: string;
  department: string;
  designation: string;
}

interface AttendanceLog {
  _id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "On Time" | "Late" | "Absent";
  workingHours?: number | string;
  formattedDuration?: string;
}

interface HistoryStats {
  totalDays: number;
  onTimeDays: number;
  lateDays: number;
  absentDays: number;
  totalHours: number;
  attendanceRate: number;
}

interface HistoryProps {
  employees: Employee[];
  selectedEmployeeId: string;
  onEmployeeChange: (id: string) => void;
  period: "this-month" | "last-month" | "all";
  onPeriodChange: (p: "this-month" | "last-month" | "all") => void;
  reloadKey?: number;
}

/** Converts "HH:MM" 24-hour time string to 12-hour AM/PM format */
function formatTo12Hour(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function formatToLocalTimeInput(dateString: string | null | undefined, defaultTime: string): string {
  if (!dateString) return defaultTime;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return defaultTime;
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const hh = parts.find(p => p.type === "hour")?.value || "00";
  const mm = parts.find(p => p.type === "minute")?.value || "00";
  return `${hh}:${mm}`;
}

export default function HistoryAnalytics({
  employees,
  selectedEmployeeId,
  onEmployeeChange,
  period,
  onPeriodChange,
  reloadKey = 0,
}: HistoryProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState({ name: "", designation: "", department: "" });
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [stats, setStats] = useState<HistoryStats>({
    totalDays: 0,
    onTimeDays: 0,
    lateDays: 0,
    absentDays: 0,
    totalHours: 0,
    attendanceRate: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // Modular Retro Modal Controls
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [dialogForm, setDialogForm] = useState({
    date: "",
    checkIn: "09:00",
    checkOut: "17:00",
    status: "On Time" as "On Time" | "Late" | "Absent",
  });

  const [isEmpOpen, setIsEmpOpen] = useState(false);
  const empRef = useRef<HTMLDivElement>(null);

  const selectedEmp = employees.find((e) => e.userId === selectedEmployeeId);
  const todayStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }).slice(0, 10);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (empRef.current && !empRef.current.contains(event.target as Node)) {
        setIsEmpOpen(false);
      }
    }
    if (isEmpOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEmpOpen]);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    let isMounted = true;

    async function fetchHistory() {
      // Defer state update to a microtask, ensuring no synchronous state updates inside useEffect trigger cascading renders
      await Promise.resolve();
      if (!isMounted) return;

      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/employee-attendance?userId=${selectedEmployeeId}&period=${period}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setLogs(data.logs || []);
          setReport(data.report || null);
          setEmployeeProfile(data.employee || { name: "", designation: "", department: "" });
          setStats(data.stats || {});
          setIsLocked(!!data.isLocked);
        }
      } catch (err) {
        console.error("Failed loading history statistics:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedEmployeeId, period, refreshCounter, reloadKey]);

  const handleOpenAddModal = () => {
    setEditingLogId(null);
    setDialogForm({
      date: todayStr,
      checkIn: "09:00",
      checkOut: "17:00",
      status: "On Time",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (log: AttendanceLog) => {
    setEditingLogId(log._id);
    setDialogForm({
      date: log.date,
      checkIn: formatToLocalTimeInput(log.checkIn, "09:00"),
      checkOut: formatToLocalTimeInput(log.checkOut, "17:00"),
      status: log.status,
    });
    setIsModalOpen(true);
  };

  const handleSaveRetroLog = async (payload: {
    userId: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    status: "On Time" | "Late" | "Absent";
  }) => {
    const res = await fetch("/api/admin/employee-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorMsg = await res.json();
      throw new Error(errorMsg?.error || "Execution failed.");
    }
    setRefreshCounter((prev) => prev + 1);
  };

  const periodText =
    period === "last-month"
      ? `Last Month (${karachiMonthLabel(-1)})`
      : period === "all"
        ? "all saved records"
        : `This Month (${karachiMonthLabel(0)})`;

  const deleteAttendance = async (
    body: { userId: string; date?: string; period?: HistoryProps["period"] },
    confirm: { title: string; html: string },
    key: string
  ) => {
    const result = await Swal.fire({
      title: confirm.title,
      html: confirm.html,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: "bg-white border border-line-subtle rounded-2xl shadow-xl p-6 font-sans text-center",
        title: "text-base font-bold text-content-main",
        htmlContainer: "text-xs text-content-secondary mt-2 leading-relaxed",
        actions: "flex gap-2 justify-center mt-5 w-full",
        confirmButton:
          "px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer",
        cancelButton:
          "px-4 py-2.5 bg-surface-main hover:bg-line-subtle text-content-secondary text-xs font-semibold rounded-xl transition cursor-pointer",
      },
    });
    if (!result.isConfirmed) return;

    setDeletingKey(key);
    try {
      const res = await fetch("/api/admin/employee-attendance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
        skippedLocked?: number;
      };
      if (!res.ok) throw new Error(payload.error || "Could not delete attendance.");
      setRefreshCounter((prev) => prev + 1);
      const kept = payload.skippedLocked
        ? ` ${payload.skippedLocked} locked record${payload.skippedLocked === 1 ? "" : "s"} kept.`
        : "";
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `Deleted ${payload.deleted || 0} record${payload.deleted === 1 ? "" : "s"}.${kept}`,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: err instanceof Error ? err.message : "Could not delete attendance.",
      });
    } finally {
      setDeletingKey(null);
    }
  };

  const employeeName = employeeProfile.name || selectedEmp?.name || "this employee";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Configuration Controls & Aggregate Cards */}
      <div className="xl:col-span-4 space-y-6">
        <div className="bg-white border border-line-subtle rounded-2xl p-5 shadow-3xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-accent" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-content-main">
                Historical Lookup Parameters
              </span>
            </div>
            {selectedEmployeeId && !isLocked && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent text-white hover:bg-brand-hover text-[10px] font-bold rounded-lg cursor-pointer transition shadow-xs"
              >
                <span>Add Record Row</span>
              </button>
            )}
          </div>

          {/* Select Target employee */}
          <div className="space-y-1.5 relative" ref={empRef}>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-content-muted">
              Select Employee
            </label>
            
            <button
              type="button"
              onClick={() => setIsEmpOpen(!isEmpOpen)}
              className="w-full px-3.5 py-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main transition-all duration-200 shadow-sm outline-none hover:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent flex items-center justify-between text-left cursor-pointer relative font-semibold"
            >
              <span>
                {selectedEmp
                  ? `${selectedEmp.name}${selectedEmp.designation ? ` (${selectedEmp.designation})` : ""}`
                  : "Select an Employee..."}
              </span>
              <ChevronDown 
                className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                  isEmpOpen ? "rotate-180" : ""
                }`} 
              />
            </button>

            {isEmpOpen && (
              <div className="dropdown-panel absolute left-0 right-0 mt-1.5 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150 z-50">
                {employees.map((e) => (
                  <button
                    key={e.userId}
                    type="button"
                    onClick={() => {
                      onEmployeeChange(e.userId);
                      setIsEmpOpen(false);
                    }}
                    className={`dropdown-option w-full text-left text-xs cursor-pointer ${
                      selectedEmployeeId === e.userId ? "dropdown-option-active" : ""
                    }`}
                  >
                    {e.name}{e.designation ? ` (${e.designation})` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Select period ranges */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-content-muted">Time Period</label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onPeriodChange("last-month")}
                className={`w-full py-2.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                  period === "last-month"
                    ? "bg-brand-subtle text-brand-accent border-brand-accent"
                    : "bg-white text-content-secondary border-line-subtle hover:bg-slate-50"
                }`}
              >
                Last Month ({karachiMonthLabel(-1)})
              </button>
              <button
                onClick={() => onPeriodChange("this-month")}
                className={`w-full py-2.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                  period === "this-month"
                    ? "bg-brand-subtle text-brand-accent border-brand-accent"
                    : "bg-white text-content-secondary border-line-subtle hover:bg-slate-50"
                }`}
              >
                This Month ({karachiMonthLabel(0)})
              </button>
              <button
                onClick={() => onPeriodChange("all")}
                className={`w-full py-2.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                  period === "all"
                    ? "bg-brand-subtle text-brand-accent border-brand-accent"
                    : "bg-white text-content-secondary border-line-subtle hover:bg-slate-50"
                }`}
              >
                All Partitioned Records
              </button>
            </div>
          </div>

          {/* Profile details block */}
          {selectedEmp && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-content-muted font-bold uppercase tracking-wider block">Staff Profile</span>
                {isLocked && (
                  <span className="flex items-center gap-1 text-rose-600 font-bold text-[10px] uppercase">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>
              <div className="font-extrabold text-content-main">{selectedEmp.name}</div>
              <div className="text-[10px] text-content-secondary">Designation: {selectedEmp.designation}</div>
              <div className="text-[10px] text-content-secondary">Department: {selectedEmp.department}</div>
            </div>
          )}
        </div>

        {/* Aggregate Stats Dashboard */}
        <div className="bg-white border border-line-subtle rounded-2xl p-5 shadow-3xs space-y-4">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-content-muted">
            Aggregated Analytics
          </div>

          {isLoading ? (
            <div className="py-6 text-center text-xs text-content-secondary animate-pulse">Recalculating stats...</div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-brand-accent flex items-center justify-center font-black text-lg text-brand-accent bg-brand-subtle">
                  {stats.attendanceRate || 0}%
                </div>
                <div>
                  <div className="text-xs font-black text-content-main">Attendance Rate</div>
                  <p className="text-[10px] text-content-secondary mt-0.5 leading-relaxed">
                    Based on {stats.totalDays || 0} tracked schedule timesheet dates.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-center">
                <div className="bg-slate-50 p-2 border border-slate-100 rounded-xl">
                  <div className="text-[9px] font-extrabold text-emerald-800 uppercase">Attended</div>
                  <div className="text-base font-black text-emerald-600 mt-0.5">{report?.summary.attendedHours ?? stats.totalHours ?? 0} hrs</div>
                </div>
                <div className="bg-slate-50 p-2 border border-slate-100 rounded-xl">
                  <div className="text-[9px] font-extrabold text-sky-800 uppercase">Paid hours</div>
                  <div className="text-base font-black text-sky-600 mt-0.5">{report?.summary.paidHours ?? 0} hrs</div>
                </div>
                <div className="bg-slate-50 p-2 border border-slate-100 rounded-xl">
                  <div className="text-[9px] font-extrabold text-rose-800 uppercase">Short</div>
                  <div className="text-base font-black text-rose-600 mt-0.5">{report?.summary.shortHours ?? 0} hrs</div>
                </div>
                <div className="bg-slate-50 p-2 border border-slate-100 rounded-xl">
                  <div className="text-[9px] font-extrabold text-indigo-800 uppercase">Total payable</div>
                  <div className="text-base font-black text-indigo-600 mt-0.5">{report?.summary.totalHours ?? stats.totalHours ?? 0} hrs</div>
                </div>
              </div>
              <p className="text-[10px] text-content-secondary leading-relaxed">
                Monday to Saturday. A full day is 8 hours. Late is only the arrival flag. Paid leave and company holidays add 8 paid hours with no shortfall.
              </p>
            </>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: DETAIL WORKLOG LIST */}
      <div className="xl:col-span-8">
        <div className="bg-white border border-line-subtle rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-line-subtle bg-slate-50/60 flex items-center justify-between gap-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-content-muted">
              Historical Worklogs Ledger
            </span>
            <div className="flex items-center gap-2">
              {selectedEmployeeId && (
                <button
                  type="button"
                  disabled={deletingKey !== null}
                  onClick={() =>
                    void deleteAttendance(
                      { userId: selectedEmployeeId, period },
                      {
                        title: "Delete attendance history?",
                        html: `Attendance days for <b>${employeeName}</b> in <b>${periodText}</b> will be removed, including absent days with no fingerprint. Holidays and leave stay. This cannot be undone.`,
                      },
                      `period:${period}`
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete History
                </button>
              )}
            <button
              type="button"
              disabled={!report || report.days.length === 0}
              onClick={() => {
                if (!report) return;
                void downloadAttendanceReport({
                  employeeName: employeeProfile.name || selectedEmp?.name || "Employee",
                  designation: employeeProfile.designation || selectedEmp?.designation || "",
                  department: employeeProfile.department || selectedEmp?.department || "",
                  periodLabel:
                    period === "last-month"
                      ? `Last Month (${karachiMonthLabel(-1)})`
                      : period === "all"
                        ? "This Year"
                        : `This Month (${karachiMonthLabel(0)})`,
                  report,
                });
              }}
              className="rounded-lg bg-brand-accent px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
            >
              Download PDF
            </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/20 border-b border-line-subtle text-[10px] font-extrabold uppercase tracking-widest text-content-muted">
                  <th className="px-6 py-4">Punch Date</th>
                  <th className="px-6 py-4">Check-In</th>
                  <th className="px-6 py-4">Check-Out</th>
                  <th className="px-6 py-4">Worked</th>
                  <th className="px-6 py-4">Short</th>
                  <th className="px-6 py-4">Paid</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-content-secondary animate-pulse">
                      Retrieving partitioned logs database...
                    </td>
                  </tr>
                ) : (report?.days.length || 0) === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-content-secondary">
                      No matching historical logs found for the selected date range.
                    </td>
                  </tr>
                ) : (
                  report?.days.map((row) => {
                    const log = logs.find((item) => item.date === row.date);
                    let badgeStyle = "bg-slate-50 text-slate-700 border-slate-200";
                    if (row.arrival === "On Time") badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
                    if (row.arrival === "Late") badgeStyle = "bg-amber-50 text-amber-700 border-amber-100";
                    if (row.arrival === "Absent" || row.arrival === "Unpaid leave") badgeStyle = "bg-rose-50 text-rose-700 border-rose-100";
                    if (row.arrival === "Holiday" || row.arrival === "Paid leave") badgeStyle = "bg-sky-50 text-sky-700 border-sky-100";

                    return (
                      <tr key={row.date} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 font-black text-content-main">{row.date}</td>
                        <td className="px-6 py-4 font-mono font-semibold">{row.checkIn}</td>
                        <td className="px-6 py-4 font-mono font-semibold">{row.checkOut}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-500">{row.worked}</td>
                        <td className="px-6 py-4 font-mono font-extrabold text-rose-600">{row.short}</td>
                        <td className="px-6 py-4 font-mono font-bold text-sky-700">{row.paid}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${badgeStyle}`}>
                            {row.arrival}
                          </span>
                          <div className="mt-1 text-[10px] text-content-secondary">{row.detail}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            {log && !isLocked ? (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(log)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer inline-flex items-center justify-center"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={deletingKey !== null}
                              onClick={() =>
                                void deleteAttendance(
                                  { userId: selectedEmployeeId, date: row.date },
                                  {
                                    title: "Delete this day?",
                                    html: `<b>${row.date}</b> will be removed from <b>${employeeName}</b>'s attendance history and will not count as short hours. This cannot be undone.`,
                                  },
                                  row.date
                                )
                              }
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer inline-flex items-center justify-center disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modularized Retro Modal Integration */}
      <RetroLogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId={selectedEmployeeId}
        isLocked={isLocked}
        editingLogId={editingLogId}
        initialData={dialogForm}
        onSave={handleSaveRetroLog}
      />
    </div>
  );
}