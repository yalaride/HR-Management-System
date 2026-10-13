"use client";

import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { 
  Clock, 
  CheckCircle2, 
  History,
  Timer,
  Fingerprint
} from "lucide-react";

interface AttendanceRecord {
  _id: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  workingHours?: number;
  formattedDuration?: string;
  status: "On Time" | "Late" | "Absent";
}

interface ActiveSettings {
  shiftStart: string;
  shiftEnd: string;
  gracePeriod: number;
  checkInDisplayBefore: number;
  checkOutDisplayAfter: number;
  autoCheckOut: boolean;
}

function ClockWidget() {
  const [currentTime, setCurrentTime] = useState<string>("--:--:--");

  useEffect(() => {
    const updateTime = () => {
      const nowStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(new Date());
      setCurrentTime(nowStr);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-sm font-bold text-content-main tabular-nums">
      {currentTime}
    </span>
  );
}

const DEFAULT_SETTINGS: ActiveSettings = {
  shiftStart: "09:00",
  shiftEnd: "17:00",
  gracePeriod: 15,
  checkInDisplayBefore: 30,
  checkOutDisplayAfter: 30,
  autoCheckOut: false,
};

export default function EmployeeAttendancePage() {
  // Shares the "/api/employee/attendance" cache with the employee dashboard,
  // so switching between the two pages is instant.
  const {
    data: attendanceData,
    error: loadError,
    isLoading: loading,
    mutate: refreshAttendance,
  } = useSWR<{
    todayRecord?: AttendanceRecord | null;
    history?: AttendanceRecord[];
    settings?: ActiveSettings;
  }>("/api/employee/attendance");

  const todayRecord = attendanceData?.todayRecord || null;
  const history = useMemo(() => attendanceData?.history || [], [attendanceData]);
  const settings = attendanceData?.settings || DEFAULT_SETTINGS;

  // Total accumulated working hours excluding Absent days
  const totalAccumulatedHours = useMemo(() => {
    const total = history.reduce((sum, record) => {
      if (record.status === "Absent") return sum;
      return sum + (record.workingHours || 0);
    }, 0);
    return Math.round(total * 100) / 100;
  }, [history]);

  const getStatusBadgeStyle = (status: AttendanceRecord["status"]) => {
    switch (status) {
      case "On Time":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Late":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Absent":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-surface-main text-content-secondary border-line-subtle";
    }
  };

  const formatTimeStr = (isoString?: string) => {
    if (!isoString) return "--:--";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(isoString));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-75 text-xs text-content-secondary">
        Syncing attendance log data...
      </div>
    );
  }

  // Surface a hard load failure instead of rendering an empty page
  if (loadError && !attendanceData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-75 gap-3 text-center px-4">
        <span className="text-xs font-semibold text-content-secondary">
          Could not load your attendance data. Please check your connection.
        </span>
        <button
          type="button"
          onClick={() => refreshAttendance()}
          className="px-4 py-2 bg-brand-accent hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="pb-6 border-b border-line-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-content-main tracking-tight">
            Shift Attendance
          </h1>
          <p className="mt-1 text-xs text-content-secondary leading-relaxed">
            Your punches are recorded on the office fingerprint device. This page shows those times.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-surface-card border border-line-subtle py-2 px-4 rounded-xl shadow-xs shrink-0 self-start sm:self-auto">
          <Clock className="w-4 h-4 text-brand-accent animate-pulse" />
          <ClockWidget />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-brand-subtle bg-brand-subtle/50 p-4 text-xs text-content-main">
        <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
        <p>
          Check-in and check-out happen on the fingerprint device. Arrivals after the {settings.gracePeriod || 15} minute grace period are marked Late.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-5 sm:p-6 rounded-2xl border border-line-subtle bg-surface-card shadow-xs flex flex-col justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-content-muted">Today&apos;s Check-In</span>
            <h2 className="text-base sm:text-lg font-extrabold text-content-main">Recorded Entrance</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-brand-subtle text-brand-accent">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-content-muted block font-medium">Device punch</span>
              <span className="text-sm font-bold text-content-main">
                {todayRecord?.checkIn ? formatTimeStr(todayRecord.checkIn) : "Not recorded"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl border border-line-subtle bg-surface-card shadow-xs flex flex-col justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-content-muted">Today&apos;s Check-Out</span>
            <h2 className="text-base sm:text-lg font-extrabold text-content-main">Recorded Exit</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-content-muted block font-medium">Device punch</span>
              <span className="text-sm font-bold text-content-main">
                {todayRecord?.checkOut ? formatTimeStr(todayRecord.checkOut) : "Not recorded"}
              </span>
            </div>
          </div>
        </div>

        {/* Diagnostics */}
        <div className="p-5 sm:p-6 rounded-2xl border border-line-subtle bg-surface-card shadow-xs flex flex-col justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-content-muted">Session Diagnostics</span>
            <h2 className="text-base sm:text-lg font-extrabold text-content-main">Status & Active Hours</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line-subtle pb-2.5">
              <span className="text-xs text-content-secondary font-medium flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-content-muted" /> Today&apos;s Session
              </span>
              <span className="text-xs font-bold text-content-main">
                {todayRecord?.status === "Absent" ? "0 hrs 0 mins" : todayRecord?.formattedDuration || "0 hrs 0 mins"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-line-subtle pb-2.5">
              <span className="text-xs text-content-secondary font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-content-muted" /> Monthly Total
              </span>
              <span className="text-xs font-bold text-brand-accent">
                {totalAccumulatedHours} hrs
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-content-secondary font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-content-muted" /> Attendance State
              </span>
              {todayRecord ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${getStatusBadgeStyle(todayRecord.status)}`}>
                  {todayRecord.status}
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-content-muted uppercase">Unregistered</span>
              )}
            </div>
          </div>
          <div className="text-[10px] leading-normal text-content-muted text-center pt-2">
            Status calculations adapt instantly based on daily checkpoints saved.
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-content-muted">
          <History className="w-3.5 h-3.5" /> Recent Attendance History
        </div>

        <div className="bg-surface-card border border-line-subtle rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-150">
              <thead>
                <tr className="bg-surface-main/60 border-b border-line-subtle text-content-muted text-[10px] font-extrabold uppercase tracking-widest">
                  <th className="px-6 py-4">Logged Date</th>
                  <th className="px-6 py-4">Check-In Event</th>
                  <th className="px-6 py-4">Check-Out Event</th>
                  <th className="px-6 py-4">Working Hours</th>
                  <th className="px-6 py-4 text-center">Calculated State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle text-content-secondary text-xs">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-content-muted">
                      No punches recorded yet. They will appear after the fingerprint device is connected.
                    </td>
                  </tr>
                ) : (
                  history.map((record) => (
                    <tr key={record._id} className="hover:bg-surface-main/50 transition">
                      <td className="px-6 py-4 font-bold text-content-main">
                        {record.date}
                      </td>
                      <td className="px-6 py-4 font-medium text-content-secondary">
                        {formatTimeStr(record.checkIn)}
                      </td>
                      <td className="px-6 py-4 font-medium text-content-secondary">
                        {record.checkOut ? formatTimeStr(record.checkOut) : "Ongoing"}
                      </td>
                      <td className="px-6 py-4 font-bold text-content-main">
                        {record.status === "Absent" ? "--" : record.formattedDuration || "--"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wide ${getStatusBadgeStyle(record.status)}`}>
                            {record.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}