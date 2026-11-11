import React from "react";
import { X, Calendar, Info } from "lucide-react";
import { LeaveRequest } from "@/lib/types";

interface LeaveDetailsModalProps {
  leave: LeaveRequest;
  onClose: () => void;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

export const LeaveDetailsModal: React.FC<LeaveDetailsModalProps> = ({
  leave,
  onClose,
  onApprove,
  onReject,
  isAdmin = false,
}) => {
  const getLeaveTypeStyles = (type?: string) => {
    const t = String(type || "").toUpperCase();
    if (t.includes("ANNUAL") || t.includes("FULL")) {
      return "bg-brand-subtle text-brand-accent border-brand-accent/20";
    }
    if (t.includes("SICK")) {
      return "bg-rose-50 text-rose-700 border-rose-100";
    }
    if (t.includes("CASUAL") || t.includes("URGENT")) {
      return "bg-amber-50 text-amber-700 border-amber-100";
    }
    if (t.includes("HALF") || t.includes("EXTRA")) {
      return "bg-sky-50 text-sky-700 border-sky-100";
    }
    return "bg-surface-main text-content-secondary border-line-subtle";
  };

  const isExceeded =
    leave.fullRemaining === undefined &&
    leave.remainingLeaves !== undefined &&
    leave.days > leave.remainingLeaves;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      
      {/* Click backdrop to close */}
      <div 
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className="relative bg-surface-card border border-line-subtle rounded-2xl w-full max-w-lg shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-150 overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Subtle purple accent line at the top */}
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-brand-accent to-brand-hover" />
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-line-subtle bg-surface-main flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-content-main tracking-tight">Leave Request Details</h3>
            <p className="text-[10px] text-content-muted mt-0.5 font-medium">Review the details of this leave request.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-brand-accent hover:bg-brand-subtle transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          
          {/* Employee Information */}
          <div className="flex justify-between items-start gap-4">
            <div>
              <h4 className="font-bold text-content-main text-sm leading-tight">
                {leave.employeeName || "Your Request"}
              </h4>
              <p className="text-xs text-content-secondary mt-0.5">
                {leave.designation || "Internal"}
              </p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide uppercase border ${getLeaveTypeStyles(leave.type)}`}>
              {leave.type}
            </span>
          </div>

          {/* Leave Balances Details */}
          <div className="space-y-2">
            <span className="field-label block">
              {leave.monthLabel ? `${leave.monthLabel} allowance` : "Leave Balances"}
            </span>

            {leave.fullRemaining !== undefined ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-center">
                  <span className="block text-[9px] font-bold uppercase text-indigo-700">Full days left</span>
                  <span className="text-base font-extrabold text-content-main">
                    {leave.fullRemaining} <span className="text-[10px] font-medium">of 2</span>
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold text-content-secondary">Used {leave.fullUsed ?? 0}</span>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-center">
                  <span className="block text-[9px] font-bold uppercase text-sky-700">Half day left</span>
                  <span className="text-base font-extrabold text-content-main">
                    {leave.halfRemaining} <span className="text-[10px] font-medium">of 1</span>
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold text-content-secondary">Used {leave.halfUsed ?? 0}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 bg-surface-main/60 border border-line-subtle rounded-xl p-3">
              <div className="text-center">
                <span className="block text-[9px] uppercase font-bold text-content-muted">Total</span>
                <span className="text-base font-extrabold text-content-main">
                  {leave.totalLeaves ?? "--"} <span className="text-[10px] font-medium">days</span>
                </span>
              </div>
              <div className="text-center border-x border-line-subtle">
                <span className="block text-[9px] uppercase font-bold text-content-muted">Used</span>
                <span className="text-base font-extrabold text-amber-600">
                  {leave.usedLeaves ?? 0} <span className="text-[10px] font-medium">days</span>
                </span>
              </div>
              <div className="text-center">
                <span className="block text-[9px] uppercase font-bold text-content-muted">Remaining</span>
                <span className="text-base font-extrabold text-brand-accent">
                  {leave.remainingLeaves ?? "--"} <span className="text-[10px] font-medium">days</span>
                </span>
              </div>
              </div>
            )}

            {isExceeded && isAdmin && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 text-[11px] font-medium rounded-lg flex items-center gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span>Warning: Requested days ({leave.days}) exceed remaining leaves ({leave.remainingLeaves}).</span>
              </div>
            )}
          </div>

          {/* Request Details */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-line-subtle">
            <div>
              <span className="field-label block">Duration</span>
              <span className="text-xs font-bold text-content-main flex items-center gap-1 mt-1">
                <Calendar className="w-3.5 h-3.5 text-content-muted" />
                {leave.days} {leave.days === 1 ? "day" : "days"}
              </span>
            </div>
            <div>
              <span className="field-label block">Dates</span>
              <span className="text-xs font-semibold text-content-secondary block mt-1">
                {leave.startDate} to {leave.endDate}
              </span>
            </div>
          </div>

          {/* Full Reason Section */}
          <div className="pt-3 border-t border-line-subtle">
            <span className="field-label block">Full Reason</span>
            <div className="mt-1.5 p-3.5 bg-surface-main/60 border border-line-subtle text-content-secondary text-xs rounded-xl leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {leave.reason || "No detailed reason provided."}
            </div>
          </div>

        </div>

        {/* Action Controls */}
        <div className="px-6 py-4 border-t border-line-subtle bg-surface-main flex justify-between items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-line-subtle text-content-secondary hover:text-content-main hover:bg-brand-subtle rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
          
          <div className="flex gap-2">
            {String(leave.status).toUpperCase() === "PENDING" && onApprove && onReject ? (
              <>
                <button
                  onClick={() => onReject(leave.id)}
                  className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  Reject
                </button>
                <button
                  onClick={() => onApprove(leave.id)}
                  className="px-4 py-2 bg-brand-accent hover:bg-brand-hover text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                >
                  Approve
                </button>
              </>
            ) : (
              <div className="text-xs text-content-muted italic font-semibold">
                Status: {leave.status}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};