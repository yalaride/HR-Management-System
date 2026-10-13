"use client";

import React from "react";
import { 
  Calendar, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Inbox,
  ArrowRight
} from "lucide-react";

export interface LeaveRecord {
  id: string;
  type: string;
  typeUpper?: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  statusUpper?: string;
}

interface LeaveHistoryTableProps {
  history: LeaveRecord[];
}

const statusConfig: Record<
  string,
  { bg: string; text: string; border: string; icon: React.ReactNode; dot: string }
> = {
  APPROVED: {
    bg: "bg-emerald-50/80",
    text: "text-emerald-700",
    border: "border-emerald-200/60",
    dot: "bg-emerald-500",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  },
  REJECTED: {
    bg: "bg-rose-50/80",
    text: "text-rose-700",
    border: "border-rose-200/60",
    dot: "bg-rose-500",
    icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
  },
  PENDING: {
    bg: "bg-amber-50/80",
    text: "text-amber-700",
    border: "border-amber-200/60",
    dot: "bg-amber-500",
    icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
  },
};

const typeConfig: Record<string, { label: string; badgeClass: string }> = {
  ANNUAL: {
    label: "Annual Leave",
    badgeClass: "bg-indigo-50/80 text-indigo-700 border-indigo-200/60",
  },
  SICK: {
    label: "Sick Leave",
    badgeClass: "bg-rose-50/80 text-rose-700 border-rose-200/60",
  },
  CASUAL: {
    label: "Casual Leave",
    badgeClass: "bg-violet-50/80 text-violet-700 border-violet-200/60",
  },
};

export default function LeaveHistoryTable({ history }: LeaveHistoryTableProps) {
  return (
    <div className="space-y-3.5 w-full">
      {/* Header Section */}
      {/* Header Section */}
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
  <div className="min-w-0 px-2 py-1.5">
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
      Request History
    </h3>
    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
      Overview of all your submitted leave applications
    </p>
  </div>
  <span className="self-start sm:self-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200/50">
    {history.length} {history.length === 1 ? "Record" : "Records"}
  </span>
</div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
              <Inbox className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No leave requests found</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              You haven&apos;t submitted any leave applications yet. New requests will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-5">Type</th>
                  <th className="py-3.5 px-5">Dates Requested</th>
                  <th className="py-3.5 px-5">Duration</th>
                  <th className="py-3.5 px-5 max-w-xs">Reason</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 text-xs">
                {history.map((record) => {
                  const nType = String(
                    record.typeUpper || record.type || "ANNUAL"
                  ).toUpperCase();
                  const nStatus = String(
                    record.statusUpper || record.status || "PENDING"
                  ).toUpperCase();

                  const typeInfo = typeConfig[nType] || {
                    label: record.type,
                    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
                  };

                  const statusInfo = statusConfig[nStatus] || {
                    bg: "bg-slate-50",
                    text: "text-slate-600",
                    border: "border-slate-200",
                    dot: "bg-slate-400",
                    icon: <Clock className="w-3.5 h-3.5 text-slate-500" />,
                  };

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/60 transition-colors duration-150 group"
                    >
                      {/* Leave Type */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${typeInfo.badgeClass}`}
                        >
                          {typeInfo.label}
                        </span>
                      </td>

                      {/* Requested Dates */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-slate-800 font-medium text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{record.startDate}</span>
                          <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                          <span>{record.endDate}</span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                          {record.days} {record.days === 1 ? "day" : "days"}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="py-4 px-5 max-w-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span
                            className="truncate text-slate-600 text-xs block"
                            title={record.reason}
                          >
                            {record.reason || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-wide ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                        >
                          {statusInfo.icon}
                          {nStatus}
                        </span>
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
  );
}