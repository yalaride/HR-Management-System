"use client";

import React from "react";
import { 
  AlertCircle, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye,
  Trash2,
  Loader2
} from "lucide-react";

// Import the centralized LeaveRequest type. 
import { LeaveRequest } from "@/lib/types";

// Extra fields the backend may attach to a leave record beyond the base type.
type LeaveRequestWithExtras = LeaveRequest & {
  leaveType?: string;
  typeUpper?: string;
  profilePhotoUrl?: string;
};

interface LeaveTableProps {
  leaves: LeaveRequest[];
  loading: boolean;
  onSelect: (leave: LeaveRequest) => void;
  onDelete?: (leave: LeaveRequest) => void;
  deletingId?: string | null;
}
export const LeaveTable: React.FC<LeaveTableProps> = ({
  leaves,
  loading,
  onSelect,
  onDelete,
  deletingId = null,
}) => {
  // Case-insensitive status mapping to support fallback values
  const getStatusBadgeStyles = (status?: string) => {
    const s = String(status || "").toUpperCase();
    if (s === "APPROVED" || s === "APPROVE") {
      return "bg-emerald-50/80 text-emerald-700 border-emerald-100";
    }
    if (s === "REJECTED" || s === "REJECT") {
      return "bg-rose-50/80 text-rose-700 border-rose-100";
    }
    return "bg-amber-50/80 text-amber-700 border-amber-100";
  };

  // Case-insensitive leave type mapping (uses safe defaults if variables are uninitialized)
  const getLeaveTypeStyles = (type?: string) => {
    const t = String(type || "").toUpperCase();
    if (t.includes("ANNUAL")) {
      return "bg-indigo-50 text-indigo-700 border-indigo-100";
    }
    if (t.includes("SICK")) {
      return "bg-red-50 text-red-700 border-red-100";
    }
    if (t.includes("CASUAL")) {
      return "bg-sky-50 text-sky-700 border-sky-100";
    }
    if (t.includes("UNPAID")) {
      return "bg-slate-100 text-slate-700 border-slate-200";
    }
    // Safe standard fallback styling in case CSS theme variables are not defined in stylesheet
    return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
  };

  // Resolve leave type consistently from multiple possible backend keys.
  // Backend currently sends: { type: "Annual Leave" | "Sick Leave" | ... , typeUpper: "ANNUAL" | "SICK" | "CASUAL" }
  const resolveLeaveTypeTitle = (leave: LeaveRequest) => {
    const extendedLeave = leave as LeaveRequestWithExtras;

    const titleFromType = leave.type; // expected title-case
    if (titleFromType) return titleFromType;

    const titleFromLegacy = extendedLeave.leaveType;
    if (titleFromLegacy) return titleFromLegacy;

    const key = String(extendedLeave.typeUpper || "").toUpperCase();
    if (key === "ANNUAL") return "Annual Leave";
    if (key === "SICK") return "Sick Leave";
    if (key === "CASUAL") return "Casual Leave";
    if (key === "UNPAID") return "Unpaid Leave";
    if (key === "FULL") return "Full day";
    if (key === "HALF") return "Half day";
    if (key === "URGENT") return "Urgent leave";
    if (key === "EXTRA_PAID") return "Extra paid leave";

    return "Other Leave";
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-content-muted">
        <div className="flex justify-center items-center gap-2">
          <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
          <span>Loading leave records...</span>
        </div>
      </div>
    );
  }

  if (leaves.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-content-muted">
        <div className="flex flex-col items-center justify-center gap-2">
          <AlertCircle className="w-6 h-6 text-content-muted/70" />
          <span>No matching leave records found.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto vertical-slider-reset">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="table-head">
            <th className="table-cell">Employee</th>
            <th className="table-cell">Designation</th>
            <th className="table-cell">Leave Type</th>
            <th className="table-cell">Duration & Dates</th>
            <th className="table-cell max-w-xs">Reason</th>
            <th className="table-cell text-center">Status</th>
            <th className="table-cell text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle text-content-secondary text-xs">
          {leaves.map((leave) => {
            const initials = (leave.employeeName || "Employee")
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "??";

            const rawStatus = String(leave.status || "Pending").toUpperCase();

            // Resolve title-case leave type robustly from backend keys.
            const resolvedType = resolveLeaveTypeTitle(leave as LeaveRequest);

            // Safely retrieve the optional profile photo URL
            const profilePhotoUrl = (leave as LeaveRequestWithExtras).profilePhotoUrl;

            return (
              <tr key={leave.id} className="table-row-hover">
                {/* Employee Column (Name & Avatar) */}
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-main text-content-secondary border border-line-subtle flex items-center justify-center font-bold text-[11px] overflow-hidden shrink-0 relative">
                      {/* Fallback Initials rendered underneath */}
                      {initials}

                      {/* Layered Profile Image */}
                      {profilePhotoUrl && (
                        <img 
                          src={profilePhotoUrl} 
                          alt={leave.employeeName} 
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            // Hide the image immediately if loading fails (e.g., bad Cloudinary URL)
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-content-main block leading-tight capitalize">
                        {leave.employeeName}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Designation Column */}
                <td className="table-cell">
                  <span className="text-content-secondary font-medium capitalize">
                    {leave.designation || "No Designation Specified"}
                  </span>
                </td>

                {/* Leave Type Column */}
                <td className="table-cell">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide uppercase border ${getLeaveTypeStyles(resolvedType)}`}>
                    {resolvedType}
                  </span>
                </td>

                {/* Duration & Dates Column */}
                <td className="table-cell">
                  <div className="flex flex-col">
                    <span className="font-bold text-content-main flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-content-muted" />
                      {leave.days || 0} {leave.days === 1 ? "day" : "days"}
                    </span>
                    <span className="text-[10px] text-content-muted mt-1">
                      {leave.startDate || "N/A"} to {leave.endDate || "N/A"}
                    </span>
                  </div>
                </td>

                {/* Reason Column */}
                <td className="table-cell max-w-xs">
                  <button
                    onClick={() => onSelect(leave)}
                    className="flex items-start gap-1.5 text-content-secondary text-left hover:text-brand-accent group transition duration-150"
                    title="Click to view full details"
                  >
                    <FileText className="w-4 h-4 text-content-muted group-hover:text-brand-accent/80 shrink-0 mt-0.5" />
                    <span className="truncate block font-medium underline decoration-dotted underline-offset-2">
                      {leave.reason || "No reason provided"}
                    </span>
                  </button>
                </td>

                {/* Status Column */}
                <td className="table-cell text-center">
                  <div className="inline-flex items-center justify-center">
                    <span className={`status-pill ${getStatusBadgeStyles(leave.status)}`}>
                      {rawStatus === "APPROVED" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      {rawStatus === "REJECTED" && <XCircle className="w-3 h-3 text-rose-500" />}
                      {rawStatus === "PENDING" && <Clock className="w-3 h-3 text-amber-500" />}
                      {leave.status || "Pending"}
                    </span>
                  </div>
                </td>

                {/* Actions Column */}
                <td className="table-cell text-right">
                  <div className="inline-flex items-center justify-end gap-1 ml-auto">
                    <button
                      onClick={() => onSelect(leave)}
                      className="p-1.5 rounded-lg text-brand-accent hover:text-brand-hover hover:bg-brand-subtle border border-transparent hover:border-brand-accent/20 transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Review</span>
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(leave)}
                        disabled={deletingId === leave.id}
                        title="Delete leave request (restores balance)"
                        className="p-1.5 rounded-lg text-content-muted hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition inline-flex items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === leave.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
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
  );
};