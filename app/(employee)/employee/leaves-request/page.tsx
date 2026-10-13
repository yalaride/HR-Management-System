"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import LeaveHistoryTable, { LeaveRecord } from "@/app/components/employee/LeaveHistoryTable";
import { LeaveDetailsModal } from "@/app/components/admin/leaves/LeaveDetailsModal";
import ApplyLeaveModal from "@/app/components/employee/ApplyLeaveModal";
import { LeaveRequest, LeaveBalances } from "@/lib/types";

// Standard SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch data");
  }
  return res.json();
};

// Normalize any leave type format (e.g. "Annual Leave" -> "ANNUAL")
function normalizeLeaveType(type?: string): "ANNUAL" | "SICK" | "CASUAL" | "OTHER" {
  const upper = String(type || "").trim().toUpperCase();
  if (upper.includes("ANNUAL")) return "ANNUAL";
  if (upper.includes("SICK")) return "SICK";
  if (upper.includes("CASUAL")) return "CASUAL";
  return "OTHER";
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

  const balances = useMemo<LeaveBalances | null>(() => {
    if (data && !Array.isArray(data) && data.balances) return data.balances;
    return null;
  }, [data]);

  // Overall totals across all categories
  const summary = useMemo(() => {
    if (!balances) return { allocated: 0, used: 0, remaining: 0 };
    return {
      allocated: (balances.ANNUAL?.allocated ?? 0) + (balances.SICK?.allocated ?? 0) + (balances.CASUAL?.allocated ?? 0),
      used: (balances.ANNUAL?.used ?? 0) + (balances.SICK?.used ?? 0) + (balances.CASUAL?.used ?? 0),
      remaining: (balances.ANNUAL?.remaining ?? 0) + (balances.SICK?.remaining ?? 0) + (balances.CASUAL?.remaining ?? 0),
    };
  }, [balances]);

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
    const normalizedKey = normalizeLeaveType(record.type);

    const mappedType: LeaveRequest["type"] =
      normalizedKey === "ANNUAL"
        ? "Annual Leave"
        : normalizedKey === "SICK"
          ? "Sick Leave"
          : normalizedKey === "CASUAL"
            ? "Casual Leave"
            : "Other Leave";

    const mappedStatus: LeaveRequest["status"] =
      record.status?.toUpperCase() === "APPROVED"
        ? "Approved"
        : record.status?.toUpperCase() === "REJECTED"
          ? "Rejected"
          : "Pending";

    // Lookup balance safely
    const targetBalance = normalizedKey !== "OTHER" && balances ? balances[normalizedKey] : null;

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
      totalLeaves: targetBalance?.allocated ?? 0,
      usedLeaves: targetBalance?.used ?? 0,
      remainingLeaves: targetBalance?.remaining ?? 0,
    };
    setSelectedLeave(mapped);
  };

  const handleApplyLeave = async (formData: {
    type: "ANNUAL" | "SICK" | "CASUAL";
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
            Track allocated balances and request new leaves.
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
      ) : balances ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Overall Leaves Card */}
          <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <h3 className="text-xs font-bold text-brand-accent uppercase tracking-widest mb-3">
              Total Leaves
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-content-muted font-medium">Allocated:</span>
                <span className="font-bold text-content-main">{summary.allocated}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-content-muted font-medium">Used:</span>
                <span className="font-bold text-amber-600">{summary.used}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-line-subtle pt-2 mt-1">
                <span className="text-content-muted font-medium">Remaining:</span>
                <span className="font-bold text-emerald-600">{summary.remaining}</span>
              </div>
            </div>
          </div>

          {/* Categorized Cards */}
          {(["ANNUAL", "SICK", "CASUAL"] as const).map((leaveType) => {
            const balance = balances[leaveType];
            return (
              <div
                key={leaveType}
                className="bg-surface-card border border-line-subtle rounded-2xl p-5 shadow-xs flex flex-col justify-between"
              >
                <h3 className="text-xs font-bold text-content-secondary uppercase tracking-widest mb-3">
                  {leaveType === "ANNUAL" ? "Annual Leave" : leaveType === "SICK" ? "Sick Leave" : "Casual Leave"}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-content-muted font-medium">Allocated:</span>
                    <span className="font-bold text-content-main">{balance?.allocated ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-content-muted font-medium">Used:</span>
                    <span className="font-bold text-amber-600">{balance?.used ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-line-subtle pt-2 mt-1">
                    <span className="text-content-muted font-medium">Remaining:</span>
                    <span className="font-bold text-emerald-600">{balance?.remaining ?? 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
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