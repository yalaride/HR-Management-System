"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import LeaveHistoryTable, { LeaveRecord } from "@/app/components/employee/LeaveHistoryTable";
import { LeaveDetailsModal } from "@/app/components/admin/leaves/LeaveDetailsModal";
import ApplyLeaveModal from "@/app/components/employee/ApplyLeaveModal";
import { LeaveRequest } from "@/lib/types";

// Standard SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch data");
  }
  return res.json();
};

function leaveTitle(type?: string): LeaveRequest["type"] {
  const upper = String(type || "").trim().toUpperCase();
  if (upper.includes("HALF")) return "Half day";
  if (upper.includes("EXTRA")) return "Extra paid leave";
  if (upper.includes("URGENT")) return "Urgent leave";
  if (upper.includes("FULL")) return "Full day";
  if (upper.includes("ANNUAL")) return "Annual Leave";
  if (upper.includes("SICK")) return "Sick Leave";
  if (upper.includes("CASUAL")) return "Casual Leave";
  if (upper.includes("UNPAID")) return "Unpaid Leave";
  return "Other Leave";
}

export default function EmployeeLeavesPage() {
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  const {
    data,
    error: loadError,
    isLoading: loading,
    mutate: refreshLeaves,
  } = useSWR("/api/employee/leaves-request", fetcher, { revalidateOnFocus: true });

  const history = useMemo<LeaveRecord[]>(() => {
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.leaves) ? data.leaves : [];
  }, [data]);

  const canRequestLeave = !loading && !Array.isArray(data) && data?.canRequestLeave !== false;
  const displayMessage =
    message ||
    (loadError
      ? { type: "error" as const, text: loadError.message || "Failed to load leave records" }
      : !loading && !canRequestLeave
        ? {
            type: "error" as const,
            text: "Leave requests are available only for Permanent or Contract employees.",
          }
        : null);

  const handleRowClick = (record: LeaveRecord) => {
    const mappedType = leaveTitle(record.type);
    const upper = String(record.type || "").toUpperCase();
    const monthly = upper.includes("FULL") || upper.includes("HALF") || upper.includes("URGENT") || upper.includes("EXTRA");
    const quota = !Array.isArray(data) ? data?.quota?.currentMonth : undefined;

    const mappedStatus: LeaveRequest["status"] =
      record.status?.toUpperCase() === "APPROVED"
        ? "Approved"
        : record.status?.toUpperCase() === "REJECTED"
          ? "Rejected"
          : "Pending";

    const mapped: LeaveRequest = {
      id: record.id,
      employeeName: "Your Request",
      designation: "Employee",
      department: "Internal",
      type: mappedType,
      startDate: record.startDate,
      endDate: record.endDate,
      days: record.days,
      reason: record.reason,
      status: mappedStatus,
      ...(monthly && quota
        ? {
            monthLabel: quota.label,
            fullUsed: quota.fullUsed,
            fullRemaining: quota.fullRemaining,
            halfUsed: quota.halfUsed,
            halfRemaining: quota.halfRemaining,
          }
        : {}),
    };
    setSelectedLeave(mapped);
  };

  const handleApplyLeave = async (formData: {
    type: "FULL" | "HALF";
    startDate: string;
    endDate: string;
    reason: string;
  }) => {
    try {
      setSubmitting(true);
      setMessage(null);

      const res = await fetch("/api/employee/leaves-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Failed to submit leave request");

      setMessage({
        type: "success",
        text: `Leave request submitted successfully! ${responseData.newRequest?.days || ""} days requested.`,
      });

      await refreshLeaves();
      setIsApplyModalOpen(false);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to submit leave request",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-line-subtle">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-content-main tracking-tight">
            My Leave Dashboard
          </h1>
          <p className="mt-1 text-xs text-content-secondary leading-relaxed">
            This month includes 2 full days and 1 half day. A request already counts as used, so the remaining number drops straight away.
          </p>
        </div>
        <button
          onClick={() => {
            if (canRequestLeave) setIsApplyModalOpen(true);
          }}
          disabled={submitting || !canRequestLeave}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-accent text-white rounded-xl text-xs font-bold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          {canRequestLeave ? "Apply for Leave" : "Leave Not Available"}
        </button>
      </div>

      {/* Alerts */}
      {displayMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
            displayMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {displayMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{displayMessage.text}</span>
        </div>
      )}

      {/* Leave Balance Cards (Including Grand Total Card) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface-card border border-line-subtle rounded-2xl p-5 shadow-xs animate-pulse">
              <div className="h-3 w-24 rounded bg-surface-main" />
              <div className="mt-5 space-y-3">
                <div className="h-3 rounded bg-surface-main" />
                <div className="h-3 rounded bg-surface-main" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.quota?.currentMonth ? (
        <div className="overflow-hidden rounded-2xl border border-line-subtle bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-line-subtle bg-slate-50/70 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-content-muted">This month</p>
              <h2 className="mt-1 text-lg font-extrabold text-content-main">{data.quota.currentMonth.label}</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-content-secondary border border-line-subtle">
              Does not carry forward
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">Full days</p>
              <p className="mt-2 text-3xl font-black text-content-main">
                {data.quota.currentMonth.fullRemaining}
                <span className="ml-1 text-sm font-semibold text-content-muted">left of 2</span>
              </p>
              <div className="mt-3 flex gap-1.5">
                {[0, 1].map((slot) => (
                  <span
                    key={slot}
                    className={`h-2 flex-1 rounded-full ${
                      slot < data.quota.currentMonth.fullUsed ? "bg-indigo-500" : "bg-indigo-100"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-content-secondary">
                Used {data.quota.currentMonth.fullUsed}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">Half day</p>
              <p className="mt-2 text-3xl font-black text-content-main">
                {data.quota.currentMonth.halfRemaining}
                <span className="ml-1 text-sm font-semibold text-content-muted">left of 1</span>
              </p>
              <div className="mt-3 h-2 rounded-full bg-sky-100">
                <div
                  className="h-2 rounded-full bg-sky-500"
                  style={{ width: data.quota.currentMonth.halfUsed ? "100%" : "0%" }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-content-secondary">
                Used {data.quota.currentMonth.halfUsed}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Leave History Section */}
      <div
        onClick={(e) => {
          const row = (e.target as HTMLElement).closest("tbody tr") as HTMLTableRowElement | null;
          if (row) {
            const index = row.sectionRowIndex;
            if (index !== -1 && history[index]) {
              handleRowClick(history[index]);
            }
          }
        }}
        className="overflow-x-auto rounded-2xl bg-surface-card border border-line-subtle shadow-xs"
      >
        {history && history.length > 0 ? (
          <LeaveHistoryTable history={history} />
        ) : (
          <div className="text-center py-12 text-content-muted">
            <p className="text-xs font-medium">No leave records found.</p>
          </div>
        )}
      </div>

      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSubmit={handleApplyLeave}
        canRequestLeave={canRequestLeave}
      />

      {selectedLeave && (
        <LeaveDetailsModal
          leave={selectedLeave}
          onClose={() => setSelectedLeave(null)}
        />
      )}
    </div>
  );
}