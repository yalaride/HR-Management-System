"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import Swal from "sweetalert2";
import { Loader2, ShieldAlert, CheckCircle2, XCircle, CalendarDays } from "lucide-react";
import { ApiError } from "@/lib/api-client";

interface HeadLeave {
  id: string;
  employeeName: string;
  designation: string;
  department: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  remainingLeaves: number;
  totalLeaves: number;
}

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
});

const statusBadge: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-600 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-600 border-emerald-200",
  Rejected: "bg-rose-50 text-rose-600 border-rose-200",
};

export default function HeadLeavesPage() {
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("Pending");

  const { data, error, isLoading, mutate } = useSWR<{ leaves?: HeadLeave[] }>("/api/employee/head-leaves");
  const forbidden = error instanceof ApiError && error.status === 403;
  const leaves = useMemo(() => (Array.isArray(data?.leaves) ? data.leaves : []), [data]);

  const handleAction = async (leave: HeadLeave, action: "APPROVE" | "REJECT") => {
    const confirm = await Swal.fire({
      title: action === "APPROVE" ? "Approve leave?" : "Reject leave?",
      html: `<b>${leave.employeeName}</b> — ${leave.department}<br/>${leave.type}, ${leave.days} day(s)<br/>${leave.startDate} → ${leave.endDate}`,
      icon: action === "APPROVE" ? "question" : "warning",
      showCancelButton: true,
      confirmButtonText: action === "APPROVE" ? "Approve" : "Reject",
      cancelButtonText: "Cancel",
      confirmButtonColor: action === "APPROVE" ? "#059669" : "#ef4444",
    });
    if (!confirm.isConfirmed) return;

    try {
      setActioningId(leave.id);
      const res = await fetch("/api/employee/head-leaves", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leave.id, action }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to update leave.");
      await mutate();
      Toast.fire({
        icon: "success",
        title: `Leave ${action === "APPROVE" ? "approved" : "rejected"}`,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Action failed",
        text: err instanceof Error ? err.message : "Could not update leave request.",
        confirmButtonColor: "#2563eb",
      });
    } finally {
      setActioningId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-3">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        <span className="text-sm font-semibold text-content-secondary">Loading head leaves...</span>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-3 text-center px-4">
        <ShieldAlert className="w-10 h-10 text-rose-500" />
        <h2 className="text-sm font-bold text-content-main">Not allowed</h2>
        <p className="text-xs text-content-secondary max-w-sm">
          Department head leave requests are decided by Admin.
        </p>
      </div>
    );
  }

  const filtered = filter === "All" ? leaves : leaves.filter((leave) => leave.status === filter);
  const pendingCount = leaves.filter((leave) => leave.status === "Pending").length;

  return (
    <div className="min-h-screen bg-surface-main text-content-main antialiased">
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-content-main">Head Leaves</h1>
            <p className="mt-1 text-xs text-content-secondary">
              Accept or reject leave requests from department heads.
            </p>
          </div>
          {pendingCount > 0 && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              {pendingCount} pending
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {(["Pending", "All", "Approved", "Rejected"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                filter === item
                  ? "bg-brand-accent text-white border-brand-accent"
                  : "bg-white text-content-secondary border-line-subtle hover:text-content-main"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="bg-white border border-line-subtle rounded-2xl shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
              <CalendarDays className="w-8 h-8 text-content-muted" />
              <p className="text-xs font-semibold text-content-secondary">No head leave requests.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line-subtle bg-surface-subtle text-left">
                    <th className="px-4 py-3 font-bold text-content-secondary">Head</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Department</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Type</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Duration</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Days</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Reason</th>
                    <th className="px-4 py-3 font-bold text-content-secondary">Status</th>
                    <th className="px-4 py-3 font-bold text-content-secondary text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((leave) => (
                    <tr key={leave.id} className="border-b border-line-subtle last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-bold text-content-main">{leave.employeeName}</div>
                        <div className="text-[10px] text-content-secondary">{leave.designation}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{leave.department}</td>
                      <td className="px-4 py-3 font-semibold">{leave.type}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {leave.startDate} → {leave.endDate}
                      </td>
                      <td className="px-4 py-3 font-bold">{leave.days}</td>
                      <td className="px-4 py-3 max-w-55">
                        <span className="line-clamp-2">{leave.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded-lg border font-bold ${
                            statusBadge[leave.status] || "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                        >
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {leave.status === "Pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={actioningId === leave.id}
                              onClick={() => void handleAction(leave, "APPROVE")}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
                            >
                              {actioningId === leave.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actioningId === leave.id}
                              onClick={() => void handleAction(leave, "REJECT")}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right text-content-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
