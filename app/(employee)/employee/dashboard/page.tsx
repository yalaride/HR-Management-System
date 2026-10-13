"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import Swal from "sweetalert2";
import { 
  CalendarCheck, 
  Clock, 
  Fingerprint, 
  CalendarPlus, 
  X, 
  CheckCircle2,
  CalendarDays,
  ChevronDown,
  UserMinus,
  Activity
} from "lucide-react";
import { useSession } from "next-auth/react";
import PayslipList from "@/app/components/payslips/PayslipList";
import { PayslipRecord } from "@/app/components/payslips/payslipPdf";
import { MetricCard } from "@/app/components/admin/dashbord/MetricCard";
import BirthdayGreetingBanner from "@/app/components/employee/dashbord/BirthdayGreetingBanner";

interface TodayAttendanceRecord {
  checkOut?: string;
}

interface AttendanceHistoryEntry {
  status?: string;
  workedHours?: number;
}

interface EmployeeLeaveSummary {
  status?: string;
}

const swalCustomClass = {
  popup: "bg-surface-card rounded-2xl border border-line-subtle shadow-xl font-sans",
  title: "text-sm font-bold text-content-main",
  htmlContainer: "text-xs text-content-secondary",
  confirmButton: "px-4.5 py-2.5 text-xs font-bold rounded-xl text-white bg-brand-accent hover:bg-brand-hover border-none outline-none cursor-pointer transition",
};

function DynamicHeaderClock() {
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);

  useEffect(() => {
    const initial = setTimeout(() => setCurrentDateTime(new Date()), 0);
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  if (!currentDateTime) {
    return <span className="text-xs font-semibold text-content-muted">Loading time...</span>;
  }

  return (
    <span className="text-xs font-semibold text-content-secondary tabular-nums">
      {currentDateTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      })}{" "}
      •{" "}
      {currentDateTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      })}
    </span>
  );
}

export default function EmployeeDashboardPage() {
  const { data: session } = useSession();
  const leaveTypeRef = useRef<HTMLDivElement>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaveTypeDropdownOpen, setIsLeaveTypeDropdownOpen] = useState(false);
  const [leaveAppliedNotice, setLeaveAppliedNotice] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    type: "Annual Leave",
    startDate: "",
    endDate: "",
    reason: "",
  });

  // All dashboard data comes through SWR: fetched in parallel, cached across
  // employee pages (attendance / leaves / payslips reuse the same keys), and
  // revalidated in the background — revisits render instantly.
  const {
    data: attendanceData,
  } = useSWR<{
    todayRecord?: TodayAttendanceRecord | null;
    monthlyRecord?: { presentDays?: number; absentDays?: number; totalWorkingHours?: number } | null;
    history?: AttendanceHistoryEntry[];
  }>("/api/employee/attendance");

  const { data: payslipsData, isLoading } = useSWR<unknown>(
    session?.user?.email ? "/api/employee/payslips" : null
  );

  const { data: leavesData, mutate: refreshLeaves } = useSWR<unknown>(
    "/api/employee/leaves-request"
  );

  const { data: birthdayData } = useSWR<{ isBirthday?: boolean; name?: string }>(
    "/api/employee/my-birthday"
  );

  const todayRecord = attendanceData?.todayRecord || null;
  const isBirthday = Boolean(birthdayData?.isBirthday);
  const birthdayName = birthdayData?.name || "";

  const { presentDays, absentDays, totalWorkedHours } = useMemo(() => {
    if (attendanceData?.monthlyRecord) {
      return {
        presentDays: attendanceData.monthlyRecord.presentDays ?? 0,
        absentDays: attendanceData.monthlyRecord.absentDays ?? 0,
        totalWorkedHours: attendanceData.monthlyRecord.totalWorkingHours ?? 0,
      };
    }

    const history = attendanceData?.history || [];
    if (history.length === 0) {
      return { presentDays: 0, absentDays: 0, totalWorkedHours: 0 };
    }

    const actualPresents = history.filter(
      (r) => r.status === "On Time" || r.status === "Late"
    ).length;
    const actualAbsents = history.filter((r) => r.status === "Absent").length;
    const totalHours = history.reduce((acc, curr) => acc + (curr.workedHours || 0), 0);

    return {
      presentDays: actualPresents,
      absentDays: actualAbsents,
      totalWorkedHours: totalHours || actualPresents * 8,
    };
  }, [attendanceData]);

  const payslips = useMemo<PayslipRecord[]>(() => {
    const data = payslipsData as
      | PayslipRecord[]
      | { payslips?: PayslipRecord[]; data?: PayslipRecord[] }
      | undefined;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.payslips)) return data.payslips;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }, [payslipsData]);

  const pendingLeaves = useMemo(() => {
    const data = leavesData as
      | EmployeeLeaveSummary[]
      | { leaves?: EmployeeLeaveSummary[] }
      | undefined;
    const leaves = Array.isArray(data) ? data : Array.isArray(data?.leaves) ? data.leaves : [];
    return leaves.filter((l) => String(l?.status || "").toUpperCase() === "PENDING").length;
  }, [leavesData]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (leaveTypeRef.current && !leaveTypeRef.current.contains(event.target as Node)) {
        setIsLeaveTypeDropdownOpen(false);
      }
    }
    if (isLeaveTypeDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isLeaveTypeDropdownOpen]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace(/\u0024/g, "");
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) return;

    try {
      const res = await fetch("/api/employee/leaves-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaveForm),
      });

      if (!res.ok) {
        throw new Error("API call was unsuccessful");
      }

      setIsLeaveModalOpen(false);
      setLeaveAppliedNotice(true);

      await refreshLeaves();

      setLeaveForm({
        type: "Annual Leave",
        startDate: "",
        endDate: "",
        reason: "",
      });

      setTimeout(() => {
        setLeaveAppliedNotice(false);
      }, 4000);

    } catch (err) {
      console.error("Error submitting leave request:", err);
      Swal.fire({
        title: "Error",
        text: "Could not submit your leave application. Please try again.",
        icon: "error",
        customClass: swalCustomClass,
      });
    }
  };

  const attendanceProgressPercentage = Math.min(100, Math.round((presentDays / 30) * 100));

  return (
    <div className="space-y-6 pb-12">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line-subtle">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-subtle text-brand-accent text-[10px] font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent animate-pulse" />
            Employee Portal
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-content-main">
            Employee Dashboard
          </h1>
          <p className="text-xs text-content-secondary leading-relaxed">
            Overview of your current work schedule, salary statements, and attendance records.
          </p>
        </div>

        <div className="self-start md:self-center inline-flex items-center gap-2 px-3.5 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs font-semibold shadow-xs">
          <CalendarDays className="w-4 h-4 text-brand-accent" />
          <DynamicHeaderClock />
        </div>
      </div>

      {/* Birthday Banner */}
      <BirthdayGreetingBanner isBirthday={isBirthday} birthdayName={birthdayName} />

      {/* Notice Alert */}
      {leaveAppliedNotice && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Leave Application Received</span>
            <p className="text-[11px] text-emerald-700 mt-0.5">Your request was submitted and is undergoing administration evaluation.</p>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <MetricCard
          label="Present Days"
          value={presentDays}
          icon={CalendarCheck}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-600 border-emerald-100"
          subtext="/ 30 Days"
        >
          <div className="space-y-1">
            <div className="w-full bg-surface-main h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${attendanceProgressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-content-muted">
              <span>Attendance Rate</span>
              <span>{attendanceProgressPercentage}%</span>
            </div>
          </div>
        </MetricCard>

        <MetricCard
          label="Absent Days"
          value={absentDays}
          icon={UserMinus}
          iconBgClass="bg-rose-50"
          iconColorClass="text-rose-600 border-rose-100"
          subtext="Days"
        >
          <p className="text-[10px] text-content-secondary leading-relaxed">
            Missed shifts during this payroll lifecycle.
          </p>
        </MetricCard>

        <MetricCard
          label="Worked Hours"
          value={totalWorkedHours}
          icon={Activity}
          iconBgClass="bg-brand-subtle"
          iconColorClass="text-brand-accent border-brand-subtle"
          subtext="Hrs"
        >
          <p className="text-[10px] text-content-secondary leading-relaxed">
            Cumulative logged check-in hours this month.
          </p>
        </MetricCard>

        <MetricCard
          label="Leave Requests"
          value={pendingLeaves}
          icon={Clock}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-600 border-amber-100"
          subtext="Pending"
        >
          <p className="text-[10px] text-content-secondary leading-relaxed">
            Requests currently awaiting operational sign-off.
          </p>
        </MetricCard>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Payslips Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-content-muted uppercase">
              Recent Pay Statements
            </h2>
            {payslips[0] && (
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                Latest: {payslips[0] ? formatCurrency(payslips[0].netPay) : ""}
              </span>
            )}
          </div>
          
          <div className="rounded-2xl border border-line-subtle bg-surface-card overflow-hidden">
            <PayslipList
              payslips={payslips}
              isLoading={isLoading}
              downloadingId={downloadingId}
              onDownloadStart={(id) => setDownloadingId(id)}
              onDownloadEnd={() => setDownloadingId(null)}
              title="Statement Dispatch History"
              emptyMessage="No dispatch records are mapped to your account yet."
              formatCurrency={formatCurrency}
              showEmployeeColumn={false}
            />
          </div>
        </div>

        {/* Actions Console */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <h2 className="text-xs font-bold tracking-wider text-content-muted uppercase">
              Daily Actions Console
            </h2>
          </div>

          <div className="rounded-2xl border border-line-subtle bg-surface-card p-5 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-content-main">Shift Activity Panel</h3>
              <p className="text-[11px] text-content-secondary mt-0.5">Request planned leave. Attendance punches come from the fingerprint device.</p>
            </div>

            <div className="p-4 bg-surface-main rounded-xl border border-line-subtle">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-surface-card border border-line-subtle rounded-lg text-brand-accent mt-0.5">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-content-main block">Fingerprint Attendance</span>
                  <p className="text-[11px] text-content-secondary mt-0.5">
                    {todayRecord?.checkOut
                      ? "Today's check-out is already recorded."
                      : todayRecord
                        ? "Today's check-in is recorded. Check-out will come from the device."
                        : "Check-in and check-out are recorded on the office fingerprint device."}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 bg-surface-card hover:bg-surface-main border border-line-subtle text-content-secondary hover:text-content-main text-xs font-bold rounded-xl shadow-xs transition duration-150 cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4 text-content-muted" />
              <span>Apply for Leaves</span>
            </button>
          </div>
        </div>
      </div>

      {/* Leave Application Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-content-main/40 backdrop-blur-xs transition-opacity duration-150" 
            onClick={() => setIsLeaveModalOpen(false)} 
          />
          
          <div className="relative bg-surface-card border border-line-subtle rounded-2xl max-w-md w-full p-6 shadow-2xl z-10">
            <div className="absolute top-0 inset-x-0 h-1 bg-brand-accent rounded-t-2xl" />

            <div className="flex items-center justify-between pb-4 border-b border-line-subtle">
              <div>
                <h2 className="text-base font-extrabold text-content-main">Apply for Leaves</h2>
                <p className="text-xs text-content-secondary mt-0.5">Specify request parameter fields for manager review.</p>
              </div>
              <button 
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1.5 rounded-lg text-content-muted hover:text-brand-accent hover:bg-brand-subtle transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-4 pt-4">
              <div className="space-y-1.5 relative" ref={leaveTypeRef}>
                <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Leave Type</label>
                <button
                  type="button"
                  onClick={() => setIsLeaveTypeDropdownOpen(!isLeaveTypeDropdownOpen)}
                  className="w-full px-3 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main flex items-center justify-between text-left cursor-pointer"
                >
                  <span>{leaveForm.type}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${isLeaveTypeDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isLeaveTypeDropdownOpen && (
                  <div className="dropdown-panel absolute left-0 right-0 mt-1.5 max-h-40 overflow-y-auto z-50">
                    {["Annual Leave", "Sick Leave", "Casual Leave", "Unpaid Leave"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setLeaveForm({ ...leaveForm, type });
                          setIsLeaveTypeDropdownOpen(false);
                        }}
                        className={`dropdown-option ${leaveForm.type === type ? "dropdown-option-active" : ""}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Start Date</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="form-input text-xs cursor-pointer"
                    />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Reason for Request</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Scheduled medical procedure, personal travel..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-line-subtle">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4.5 py-2.5 text-xs font-bold text-content-secondary bg-surface-main hover:bg-brand-subtle hover:text-brand-accent rounded-xl border border-line-subtle transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2.5 text-xs font-bold text-white bg-brand-accent hover:bg-brand-hover rounded-xl shadow-xs transition duration-150 cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}