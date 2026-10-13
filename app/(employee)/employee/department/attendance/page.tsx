"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Swal from "sweetalert2";
import { Loader2, ShieldAlert, Clock, Pencil, Lock, Crown, X, CheckCircle2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";

interface TeamEmployee {
  _id: string;
  userId: string;
  name: string;
  designation: string;
  department: string;
  employeeId?: string;
  profilePhotoUrl?: string;
  shiftTime?: string;
}

interface AttendanceLog {
  _id: string;
  userId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours?: number;
  formattedDuration?: string;
  status: "On Time" | "Late" | "Absent";
}

interface MonthlyRecord {
  userId: string;
  isLocked?: boolean;
}

interface DaySheet {
  employees: TeamEmployee[];
  logs: AttendanceLog[];
  monthlyRecords: MonthlyRecord[];
  shiftTimeLabel: string;
  department: string;
}

interface EditState {
  employee: TeamEmployee;
  checkInTime: string;
  checkOutTime: string;
  markAbsent: boolean;
}

const TIMEZONE = "Asia/Karachi";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
});

function todayInKarachi(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toTimeInputValue(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const statusBadge: Record<string, string> = {
  "On Time": "bg-emerald-50 text-emerald-600 border-emerald-200",
  Late: "bg-amber-50 text-amber-600 border-amber-200",
  Absent: "bg-rose-50 text-rose-600 border-rose-200",
};

export default function TeamAttendancePage() {
  const [date, setDate] = useState(todayInKarachi());
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  // Each date is its own cached key — moving between dates is instant
  const {
    data: sheet,
    error,
    isLoading: loading,
    mutate: refreshSheet,
  } = useSWR<DaySheet>(`/api/head/attendance?date=${date}`);

  // A 403 means the signed-in employee is not a department head
  const notHead = error instanceof ApiError && error.status === 403;

  const isMonthLocked = (userId: string): boolean => {
    const record = sheet?.monthlyRecords.find((r) => String(r.userId) === userId);
    return Boolean(record?.isLocked);
  };

  const openEdit = (employee: TeamEmployee) => {
    const log = sheet?.logs.find((l) => String(l.userId) === employee.userId);
    setEdit({
      employee,
      checkInTime: toTimeInputValue(log?.checkIn),
      checkOutTime: toTimeInputValue(log?.checkOut),
      markAbsent: log?.status === "Absent",
    });
  };

  const handleSave = async () => {
    if (!edit) return;

    if (!edit.markAbsent && !edit.checkInTime) {
      Swal.fire({
        icon: "warning",
        title: "Check-in required",
        text: "Set a check-in time, or mark the employee absent.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      setSaving(true);
      const payload = edit.markAbsent
        ? { userId: edit.employee.userId, date, status: "Absent" }
        : {
            userId: edit.employee.userId,
            date,
            checkIn: `${date}T${edit.checkInTime}:00+05:00`,
            checkOut: edit.checkOutTime ? `${date}T${edit.checkOutTime}:00+05:00` : null,
          };

      const res = await fetch("/api/head/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save attendance.");

      setEdit(null);
      await refreshSheet();
      Toast.fire({ icon: "success", title: "Attendance updated" });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Save failed",
        text: err instanceof Error ? err.message : "Could not save attendance.",
        confirmButtonColor: "#2563eb",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !sheet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-3">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        <span className="text-sm font-semibold text-content-secondary">Loading team attendance...</span>
      </div>
    );
  }

  if (notHead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-3 text-center px-4">
        <ShieldAlert className="w-10 h-10 text-rose-500" />
        <h2 className="text-sm font-bold text-content-main">Department head access required</h2>
        <p className="text-xs text-content-secondary max-w-sm">
          This page is only available to employees assigned as a department head by the admin.
        </p>
      </div>
    );
  }

  const employees = sheet?.employees ?? [];
  const logs = sheet?.logs ?? [];
  const presentCount = logs.filter((l) => l.status === "On Time" || l.status === "Late").length;

  return (
    <div className="min-h-screen bg-surface-main text-content-main antialiased">
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <h1 className="text-2xl font-black tracking-tight text-content-main">Team Attendance</h1>
            </div>
            <p className="mt-1 text-xs text-content-secondary">
              View and correct check-in / check-out for your <b>{sheet?.department}</b> team.
              Shift: {sheet?.shiftTimeLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              {presentCount} / {employees.length} present
            </span>
            <input
              type="date"
              value={date}
              max={todayInKarachi()}
              onChange={(e) => setDate(e.target.value)}
              className="form-input text-xs p-2 border border-line-subtle rounded-lg outline-none bg-white cursor-pointer"
            />
          </div>
        </div>

        <div className="panel bg-white border border-line-subtle rounded-2xl shadow-sm overflow-hidden">
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
              <Clock className="w-8 h-8 text-content-muted" />
              <p className="text-xs font-semibold text-content-secondary">No team members found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line-subtle bg-surface-subtle text-left">
                    <th className="px-4 py-3 font-bold text-content-secondary">Employee</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Check-In</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Check-Out</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Hours</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Status</th>
                    <th className="px-4 py-3 font-bold text-content-secondary text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const log = logs.find((l) => String(l.userId) === emp.userId);
                    const locked = isMonthLocked(emp.userId);

                    return (
                      <tr key={emp.userId} className="border-b border-line-subtle last:border-0 hover:bg-surface-subtle/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-content-main">{emp.name}</div>
                          <div className="text-[10px] text-content-secondary">{emp.designation}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold">
                          {formatTime(log?.checkIn)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold">
                          {formatTime(log?.checkOut)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log?.formattedDuration || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {log ? (
                            <span
                              className={`inline-block px-2 py-1 rounded-lg border font-bold ${
                                statusBadge[log.status] || "bg-gray-50 text-gray-500 border-gray-200"
                              }`}
                            >
                              {log.status}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 rounded-lg border font-bold bg-gray-50 text-gray-400 border-gray-200">
                              No record
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {locked ? (
                              <span
                                title="This month is locked for payroll"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-400 font-bold rounded-lg"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Locked</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEdit(emp)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-subtle hover:bg-brand-accent hover:text-white text-brand-accent font-bold rounded-lg transition cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Set Times</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-content-main/40 backdrop-blur-xs" onClick={() => !saving && setEdit(null)} />
          <div className="relative bg-white border border-line-subtle rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line-subtle">
              <div>
                <h3 className="text-sm font-bold text-content-main">Set Attendance</h3>
                <p className="text-[11px] text-content-secondary mt-0.5">
                  {edit.employee.name} — {date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !saving && setEdit(null)}
                className="p-1.5 hover:bg-surface-subtle text-content-secondary rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={edit.markAbsent}
                onChange={(e) => setEdit({ ...edit, markAbsent: e.target.checked })}
                className="w-4 h-4 rounded text-brand-accent border-line-subtle cursor-pointer"
              />
              <span className="text-xs font-bold text-content-main">Mark as Absent</span>
            </label>

            {!edit.markAbsent && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-content-secondary">Check-In</label>
                  <input
                    type="time"
                    value={edit.checkInTime}
                    onChange={(e) => setEdit({ ...edit, checkInTime: e.target.value })}
                    className="form-input text-xs w-full p-2 border border-line-subtle rounded-lg outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-content-secondary">Check-Out (optional)</label>
                  <input
                    type="time"
                    value={edit.checkOutTime}
                    onChange={(e) => setEdit({ ...edit, checkOutTime: e.target.value })}
                    className="form-input text-xs w-full p-2 border border-line-subtle rounded-lg outline-none"
                  />
                </div>
              </div>
            )}

            <p className="text-[10px] text-content-secondary">
              Status (On Time / Late) is calculated automatically from shift rules.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEdit(null)}
                className="px-3 py-2 bg-surface-main hover:bg-line-subtle text-content-secondary text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-accent hover:bg-brand-hover disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{saving ? "Saving..." : "Save"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
