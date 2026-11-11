"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Swal from "sweetalert2";
import { AlertCircle } from "lucide-react";

import { LeaveRequest } from "@/lib/types";
import { LeaveHeader } from "@/app/components/admin/leaves/LeaveHeader";
import { LeaveFilters } from "@/app/components/admin/leaves/LeaveFilters";
import { LeaveTable } from "@/app/components/admin/leaves/LeaveTable";
import { LeaveDetailsModal } from "@/app/components/admin/leaves/LeaveDetailsModal";

// Helper functions to map uppercase Database values to Frontend Title Case
const mapStatus = (status?: string): "Pending" | "Approved" | "Rejected" => {
  const s = String(status || "PENDING").toUpperCase();
  if (s === "APPROVED" || s === "APPROVE") return "Approved";
  if (s === "REJECTED" || s === "REJECT") return "Rejected";
  return "Pending";
};

const mapType = (
  type?: string
): LeaveRequest["type"] => {
  const title = String(type || "").trim();
  const upper = title.toUpperCase();
  if (upper === "FULL" || title === "Full day") return "Full day";
  if (upper === "HALF" || title === "Half day") return "Half day";
  if (upper === "URGENT" || title === "Urgent leave") return "Urgent leave";
  if (upper === "EXTRA_PAID" || title === "Extra paid leave") return "Extra paid leave";
  if (upper === "ANNUAL" || title.toLowerCase() === "annual leave") return "Annual Leave";
  if (upper === "SICK" || title.toLowerCase() === "sick leave") return "Sick Leave";
  if (upper === "CASUAL" || title.toLowerCase() === "casual leave") return "Casual Leave";
  if (upper === "UNPAID" || title.toLowerCase() === "unpaid leave") return "Unpaid Leave";
  return "Other Leave";
};

// Raw shape returned by /api/admin/leaves before UI normalization
interface RawLeaveRecord extends Omit<LeaveRequest, "id" | "status" | "type" | "designation" | "department"> {
  id?: string;
  _id?: string;
  status?: string;
  type?: string;
  designation?: string;
  department?: string;
}

export default function AdminLeavesPage() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");
  
  // Modal State
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  // Cached listing with background revalidation — instant on revisit
  const {
    data: rawLeaves,
    error: loadError,
    isLoading: loading,
    mutate: mutateLeaves,
  } = useSWR<RawLeaveRecord[]>("/api/admin/leaves");

  const leaves = useMemo<LeaveRequest[]>(() => {
    const rawArray = Array.isArray(rawLeaves) ? rawLeaves : [];
    return rawArray.map((item) => ({
      ...item,
      id: item.id || item._id,
      // Safe conversions of DB enums to UI formats
      status: mapStatus(item.status),
      type: mapType(item.type),
      // Ensure required UI fields exist
      designation: item.designation ?? "Internal",
      department: item.department ?? "Internal",
      // Fallback default values if the backend API does not serve balances yet
      totalLeaves: item.totalLeaves ?? 30,
      usedLeaves: item.usedLeaves ?? 12,
      remainingLeaves: item.remainingLeaves ?? 18,
    })) as LeaveRequest[];
  }, [rawLeaves]);

  const errorMsg =
    actionError ||
    (loadError
      ? loadError instanceof Error
        ? loadError.message
        : "Failed to load leave records"
      : null);

  // Optimistic decision: UI flips instantly, rolls back automatically on failure
  const decideLeave = async (id: string, action: "APPROVE" | "REJECT") => {
    setActionError(null);
    setSelectedLeave(null);

    const nextStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
    const applyStatus = (list: RawLeaveRecord[] | undefined, status: string) =>
      (list ?? []).map((item) =>
        (item.id || item._id) === id ? { ...item, status } : item
      );

    try {
      await mutateLeaves(
        async (current) => {
          const res = await fetch("/api/admin/leaves", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action }),
          });
          if (!res.ok) throw new Error(`Failed to ${action.toLowerCase()} leave`);

          const updated = (await res.json()) as { status?: string };
          return applyStatus(current, updated.status ?? nextStatus);
        },
        {
          optimisticData: (current) => applyStatus(current, nextStatus),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } catch {
      setActionError(
        `Failed to ${action === "APPROVE" ? "approve" : "reject"} leave request. Please try again.`
      );
    }
  };

  const handleApprove = (id: string) => decideLeave(id, "APPROVE");
  const handleReject = (id: string) => decideLeave(id, "REJECT");

  // Delete a leave entirely — the API refunds used days so the employee's
  // balance is restored (e.g. test entries or approved leaves never taken).
  const [deletingLeaveId, setDeletingLeaveId] = useState<string | null>(null);

  const handleDeleteLeave = async (leave: LeaveRequest) => {
    const isRefundable =
      String(leave.status).toUpperCase() !== "REJECTED" &&
      !String(leave.type || "").toUpperCase().includes("UNPAID");

    const result = await Swal.fire({
      title: "Delete Leave Request?",
      html: `The ${leave.days}-day <b>${leave.type}</b> entry for <b>${leave.employeeName}</b> will be permanently removed.${
        isRefundable
          ? `<br/><b>${leave.days} day(s)</b> will be restored to their leave balance.`
          : ""
      }<br/>This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
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

    setActionError(null);
    setDeletingLeaveId(leave.id);
    try {
      const res = await fetch(`/api/admin/leaves?id=${leave.id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as {
        refundedDays?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "Failed to delete leave request.");
      }

      // Revalidate so refreshed balance metrics show for remaining leaves
      await mutateLeaves();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title:
          body.refundedDays && body.refundedDays > 0
            ? `Leave deleted — ${body.refundedDays} day(s) restored`
            : "Leave deleted",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error("Leave deletion failed:", err);
      setActionError(err instanceof Error ? err.message : "Failed to delete leave request.");
    } finally {
      setDeletingLeaveId(null);
    }
  };

  // Memoized filter processing for optimized rendering
  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      if (!leave) return false;

      const employeeName = leave.employeeName || "";
      const type = leave.type || "";
      const reason = leave.reason || "";
      const search = searchQuery.toLowerCase();

      const matchesSearch =
        employeeName.toLowerCase().includes(search) ||
        type.toLowerCase().includes(search) ||
        reason.toLowerCase().includes(search);

      const matchesTab = activeTab === "All" || leave.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [leaves, searchQuery, activeTab]);

  return (
    <div className=" space-y-6 pb-12 w-full">
      {/* Top Header & Search Area */}
      <LeaveHeader 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
      />

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Table Structure Card using Global Utilities */}
      <div className="table-card overflow-x-auto vertical-slider-reset">
        {/* Tab Controls Filter Bar */}
        <LeaveFilters 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          count={filteredLeaves.length}
          loading={loading}
        />

        {/* Content Table with internal overflow handling */}
        <LeaveTable 
          leaves={filteredLeaves} 
          loading={loading} 
          onSelect={(leave) => setSelectedLeave(leave)} 
          onDelete={handleDeleteLeave}
          deletingId={deletingLeaveId}
        />
      </div>

      {/* Detail Review Modal */}
      {selectedLeave && (
        <LeaveDetailsModal 
          leave={selectedLeave} 
          onClose={() => setSelectedLeave(null)} 
          onApprove={handleApprove} 
          onReject={handleReject} 
        />
      )}
    </div>
  );
}