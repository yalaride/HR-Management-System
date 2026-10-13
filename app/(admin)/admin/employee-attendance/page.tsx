"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Plus, RefreshCw, AlertCircle } from "lucide-react";

import AttendanceSummaryCards from "@/app/components/admin/attendance/AttendanceSummaryCards";
import AttendanceFilters from "@/app/components/admin/attendance/AttendanceFilters";
import AttendanceTable from "@/app/components/admin/attendance/AttendanceTable";
import HistoryAnalytics from "@/app/components/admin/attendance/HistoryAnalytics";
import AttendanceSettings from "@/app/components/admin/settings/AttendanceSettings";

// Modal Forms Imports
import ManualAttendanceModal from "@/app/components/admin/attendance/ManualAttendanceModal";
import EditAttendanceModal from "@/app/components/admin/attendance/EditAttendanceModal";

function todayISO(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
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

function formatTo12Hour(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function formatShiftTime(shift: string): string {
  if (!shift) return "";
  const parts = shift.split(/\s*[-–—to]\s*/);
  if (parts.length >= 2) {
    const start = formatTo12Hour(parts[0].trim());
    const end = formatTo12Hour(parts[1].trim());
    return `${start} - ${end}`;
  }
  return formatTo12Hour(shift.trim());
}

type AttendanceStatus = "On Time" | "Late" | "Absent";

interface EmployeeRecord {
  id: string;
  userId: string;
  name: string;
  department: string;
  designation: string;
  profilePhotoUrl?: string;
  profilePhotoURL?: string;
  profilePicture?: string;
  image?: string;
  shiftTime?: string;
}

interface AttendanceLog {
  userId: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours?: number;
  formattedDuration?: string;
  status?: AttendanceStatus;
}

interface MonthlyRecord {
  userId: string;
  isLocked?: boolean;
}

interface CompanySettings {
  shiftStart: string;
  shiftEnd: string;
  gracePeriod: number;
  checkInDisplayBefore: number;
  checkOutDisplayAfter: number;
  autoCheckOut: boolean;
  departments?: string[];
}

interface SaveAttendancePayload {
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
}

interface DaySheetResponse {
  employees?: EmployeeRecord[];
  logs?: AttendanceLog[];
  monthlyRecords?: MonthlyRecord[];
  companySettings?: CompanySettings;
}

export default function AdminAttendancePage() {
  const [activeTab, setActiveTab] = useState<"directory" | "history-drill" | "rules">("directory");
  
  const [filterDate] = useState<string>(() => todayISO());

  // Filter criteria
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  // History states — default drill target derives from the loaded sheet
  const [drillEmployeeIdState, setDrillEmployeeId] = useState("");
  const [drillPeriod, setDrillPeriod] = useState<"this-month" | "last-month" | "all">("this-month");

  // Modal triggers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: session } = useSession();
  const canEditShiftRules = session?.user?.role === "admin";

  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    checkIn: "09:00",
    checkOut: "17:00",
    hasCheckOut: false,
    enableCheckOut: false,
    status: "On Time" as "On Time" | "Late" | "Absent",
    isLocked: false,
  });

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Day sheet is cached + revalidated in the background — instant on revisit
  const {
    data: daySheet,
    isLoading,
    mutate: refreshDaySheet,
  } = useSWR<DaySheetResponse>(`/api/admin/employee-attendance?date=${filterDate}`);

  const employees = useMemo(() => daySheet?.employees || [], [daySheet]);
  const attendanceLogs = useMemo(() => daySheet?.logs || [], [daySheet]);
  const monthlyRecords = useMemo(() => daySheet?.monthlyRecords || [], [daySheet]);
  const companySettings = daySheet?.companySettings || null;

  const drillEmployeeId = drillEmployeeIdState || employees[0]?.userId || "";

  const shiftTimeLabel = useMemo(() => {
    if (companySettings) {
      return `${formatTo12Hour(companySettings.shiftStart)} - ${formatTo12Hour(companySettings.shiftEnd)}`;
    }
    return "09:00 AM - 05:00 PM";
  }, [companySettings]);

  const mergedRecords = useMemo(() => {
    return employees.map((emp) => {
      const log = attendanceLogs.find((l) => l.userId === emp.userId);
      const currentMonthlyRecord = monthlyRecords.find((mr) => mr.userId === emp.userId);
      const isLocked = currentMonthlyRecord?.isLocked ?? false;

      return {
        userId: emp.userId,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        profilePhotoUrl: emp.profilePhotoUrl || emp.profilePhotoURL || emp.profilePicture || emp.image || "",
        shiftTime: emp.shiftTime ? formatShiftTime(emp.shiftTime) : shiftTimeLabel,

        checkIn: log?.checkIn
          ? formatTo12Hour(new Date(log.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" }))
          : "",
        checkOut: log?.checkOut
          ? formatTo12Hour(new Date(log.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" }))
          : "", 
        rawCheckIn: log?.checkIn || null,
        rawCheckOut: log?.checkOut || null,
        workingHours: log?.workingHours || 0,
        formattedDuration: log?.formattedDuration || "",
        status: (log?.status || "Absent") as "On Time" | "Late" | "Absent",
        isLocked,
      };
    });
  }, [employees, attendanceLogs, monthlyRecords, shiftTimeLabel]);

  const metrics = useMemo(() => {
    const presentCount = mergedRecords.filter((r) => r.status === "On Time" || r.status === "Late").length;
    const absentCount = mergedRecords.filter((r) => r.status === "Absent").length;
    const onTimeCount = mergedRecords.filter((r) => r.status === "On Time").length;
    const lateCount = mergedRecords.filter((r) => r.status === "Late").length;

    return {
      totalEmployees: employees.length,
      presentCount,
      absentCount,
      onTimeCount,
      lateCount,
    };
  }, [employees.length, mergedRecords]);

  const filteredRecords = useMemo(() => {
    return mergedRecords.filter((rec) => {
      const matchSearch =
        rec.name.toLowerCase().includes(searchQuery.toLowerCase()) || rec.userId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = filterDept === "All" || rec.department === filterDept;
      const matchStatus = filterStatus === "All" || rec.status === filterStatus;
      return matchSearch && matchDept && matchStatus;
    });
  }, [mergedRecords, searchQuery, filterDept, filterStatus]);

  const handleOpenEdit = (userId: string) => {
    const record = attendanceLogs.find((l) => l.userId === userId);
    const targetRecord = mergedRecords.find((r) => r.userId === userId);
    setSelectedUserId(userId);

    const hasCheckOut = !!record?.checkOut;
    const defaultCheckIn = companySettings?.shiftStart || "09:00";
    const defaultCheckOut = companySettings?.shiftEnd || "17:00";

    setEditForm({
      checkIn: formatToLocalTimeInput(record?.checkIn, defaultCheckIn),
      checkOut: formatToLocalTimeInput(record?.checkOut, defaultCheckOut),
      hasCheckOut: hasCheckOut,
      enableCheckOut: hasCheckOut, 
      status: record?.status || "On Time",
      isLocked: !!targetRecord?.isLocked,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveAttendance = async (payload: SaveAttendancePayload) => {
    const res = await fetch("/api/admin/employee-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      triggerToast("Timesheet adjusted successfully.");
      await refreshDaySheet();
    } else {
      const errData = await res.json();
      throw new Error(errData?.error || "Action adjustment failed.");
    }
  };

  const handleRefreshAttendance = async () => {
    setIsSyncing(true);
    try {
      await refreshDaySheet();
      triggerToast("Attendance refreshed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSettings = async (updatedData: Partial<CompanySettings>) => {
    try {
      const res = await fetch("/api/settings/company-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (res.ok) {
        const data = (await res.json()) as CompanySettings;
        // Merge into the cached sheet; if the sheet never loaded, do a full
        // revalidation instead of caching a partial object.
        refreshDaySheet(
          (current) => ({ ...(current ?? {}), companySettings: data }),
          { revalidate: !daySheet }
        );
        triggerToast("Rules modified and applied safely.");
      } else {
        triggerToast("Failed updating settings parameters.");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Network error saving rules.");
    }
  };

  return (
    <div className="space-y-6 max-w-375 mx-auto pb-16 text-content-main">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 bg-slate-900 border border-slate-800 text-white text-xs font-bold rounded-2xl shadow-xl">
          <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-line-subtle pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">On-Site Attendance</h1>
          <p className="mt-1 text-xs text-content-secondary">
            Review attendance and set check-in or check-out for any employee.
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            onClick={handleRefreshAttendance}
            disabled={isSyncing}
            className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line-subtle bg-slate-100 px-4 py-2.5 text-xs font-bold text-content-main transition hover:bg-slate-200 disabled:opacity-50 cursor-pointer sm:w-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? "animate-spin text-brand-accent" : ""}`} />
            <span>{isSyncing ? "Refreshing..." : "Refresh Attendance"}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-accent px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-brand-hover cursor-pointer sm:w-auto"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add Manual Attendance</span>
          </button>
        </div>
      </div>

      <div className="border-b border-line-subtle">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab("directory")}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition cursor-pointer sm:px-5 ${
              activeTab === "directory"
                ? "border-b-brand-accent text-brand-accent"
                : "border-transparent text-content-secondary hover:text-content-main"
            }`}
          >
            <span>Daily Timesheets Directory</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] text-content-secondary font-extrabold">
              {filteredRecords.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("history-drill")}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition cursor-pointer sm:px-5 ${
              activeTab === "history-drill"
                ? "border-b-brand-accent text-brand-accent"
                : "border-transparent text-content-secondary hover:text-content-main"
            }`}
          >
            <span>Employee Historical Analytics</span>
          </button>

          {canEditShiftRules && (
            <button
              onClick={() => setActiveTab("rules")}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition cursor-pointer sm:px-5 ${
                activeTab === "rules"
                  ? "border-b-brand-accent text-brand-accent"
                  : "border-transparent text-content-secondary hover:text-content-main"
              }`}
            >
              <span>Attendance Rules & Visibility</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === "directory" && (
        <div className="space-y-6">
          <AttendanceSummaryCards metrics={metrics} filterDate={filterDate} />

          <AttendanceFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterDept={filterDept}
            onDeptChange={setFilterDept}
            filterStatus={filterStatus}
            onStatusChange={setFilterStatus}
            departments={[
              "All",
              ...Array.from(
                new Set<string>(
                  (companySettings?.departments || [])
                    .filter((d) => typeof d === "string" && d.trim().length > 0)
                    .map((d) => d.trim())
                )
              ),
            ]}
            statuses={["All", "On Time", "Late", "Absent"]}
            onClear={() => {
              setSearchQuery("");
              setFilterDept("All");
              setFilterStatus("All");
            }}
          />

          {isLoading ? (
            <div className="py-12 text-center text-xs text-content-secondary animate-pulse">Retrieving timesheet logs...</div>
          ) : (
            <AttendanceTable
              records={filteredRecords}
              onEditTimesheet={handleOpenEdit}
              onDrillHistory={(id) => {
                setDrillEmployeeId(id);
                setActiveTab("history-drill");
              }}
            />
          )}
        </div>
      )}

      {activeTab === "history-drill" && (
        <HistoryAnalytics
          employees={employees}
          selectedEmployeeId={drillEmployeeId}
          onEmployeeChange={setDrillEmployeeId}
          period={drillPeriod}
          onPeriodChange={setDrillPeriod}
        />
      )}

      {canEditShiftRules && activeTab === "rules" && companySettings && (
        <AttendanceSettings
          data={companySettings}
          onSave={handleSaveSettings}
        />
      )}

      {/* Modular Manual Log Modal */}
      {isAddModalOpen && employees.length > 0 && (
        <ManualAttendanceModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          employees={employees}
          defaultDate={filterDate}
          onSave={handleSaveAttendance}
        />
      )}

      {/* Modular Edit Log Modal */}
      {isEditModalOpen && selectedUserId && (
        <EditAttendanceModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          userId={selectedUserId}
          date={filterDate}
          initialData={editForm}
          onSave={handleSaveAttendance}
        />
      )}
    </div>
  );
}