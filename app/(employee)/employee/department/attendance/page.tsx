"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Loader2, ShieldAlert, Clock, Crown } from "lucide-react";
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

const TIMEZONE = "Asia/Karachi";

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

const statusBadge: Record<string, string> = {
  "On Time": "bg-emerald-50 text-emerald-600 border-emerald-200",
  Late: "bg-amber-50 text-amber-600 border-amber-200",
  Absent: "bg-rose-50 text-rose-600 border-rose-200",
};

export default function TeamAttendancePage() {
  const [date, setDate] = useState(todayInKarachi());

  // Each date is its own cached key — moving between dates is instant
  const {
    data: sheet,
    error,
    isLoading: loading,
  } = useSWR<DaySheet>(`/api/head/attendance?date=${date}`);

  // A 403 means the signed-in employee is not a department head
  const notHead = error instanceof ApiError && error.status === 403;

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
              View check-in and check-out for your <b>{sheet?.department}</b> team. Punches are recorded on the fingerprint device.
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
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const log = logs.find((l) => String(l.userId) === emp.userId);

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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
