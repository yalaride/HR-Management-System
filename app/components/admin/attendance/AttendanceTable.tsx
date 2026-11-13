"use client";

import React from "react";
import { Building, Edit2, Eye, Clock, Lock } from "lucide-react";

interface RecordRow {
  userId: string;
  name: string;
  department: string;
  designation: string;
  shiftTime: string;
  checkIn: string;
  checkOut: string;
  rawCheckIn: string | null;
  rawCheckOut: string | null;
  workingHours: number;
  formattedDuration: string;
  status: "On Time" | "Late" | "Absent" | "Holiday" | "Leave";
  isLocked: boolean;
  // Optional profile photo fields (backend may provide any of these)
  profilePhotoUrl?: string;
  profilePhotoURL?: string;
  profilePicture?: string;
  image?: string;
}

interface TableProps {
  records: RecordRow[];
  onEditTimesheet: (userId: string) => void;
  onDrillHistory: (userId: string) => void;
}

export default function AttendanceTable({
  records,
  onEditTimesheet,
  onDrillHistory,
}: TableProps) {
  return (
    <div className="bg-white border border-line-subtle rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-line-subtle text-[10px] font-extrabold uppercase tracking-widest text-content-muted">
              <th className="px-6 py-4">Employee Information</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4">Shift Time</th>
              <th className="px-6 py-4">Duty Status</th>
              <th className="px-6 py-4">Checking Punches</th>
              <th className="px-6 py-4">Duration</th>
              <th className="px-6 py-4 text-right">Quick Management Options</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-content-secondary">
                  No active employee timesheet logs match selected criteria.
                </td>
              </tr>
            ) : (
              records.map((rec) => {
                let badgeStyle = "bg-slate-50 text-slate-700 border-slate-200";
                if (rec.status === "On Time") badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
                if (rec.status === "Late") badgeStyle = "bg-amber-50 text-amber-700 border-amber-100";
                if (rec.status === "Absent") badgeStyle = "bg-rose-50 text-rose-700 border-rose-100";
                if (rec.status === "Leave") badgeStyle = "bg-violet-50 text-violet-700 border-violet-100";
                if (rec.status === "Holiday") badgeStyle = "bg-sky-50 text-sky-700 border-sky-100";

                const isOnDuty = rec.rawCheckIn && !rec.rawCheckOut;

                return (
                  <tr key={rec.userId} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-surface-main text-content-secondary border border-line-subtle flex items-center justify-center font-bold text-[11px] overflow-hidden shrink-0 relative">
                          {/* initials fallback */}
                          {rec.name
                            ? rec.name
                                .split(" ")
                                .filter(Boolean)
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()
                            : "??"}

                          {/* optional profile photo */}
                          {(rec.profilePhotoUrl || rec.profilePhotoURL || rec.profilePicture || rec.image) ? (
                            <img
                              src={rec.profilePhotoUrl || rec.profilePhotoURL || rec.profilePicture || rec.image}
                              alt={rec.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : null}
                        </div>
                        <div>
                          <div className="font-bold text-content-main flex items-center gap-1.5">
                            <span>{rec.name}</span>
                            {rec.isLocked && <Lock className="w-3 h-3 text-rose-500" />}
                          </div>
                          <div className="text-[10px] font-mono text-content-muted">{rec.designation}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-content-secondary font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>{rec.department}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-slate-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{rec.shiftTime}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${badgeStyle}`}>
                        {rec.status}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-50 px-2 border border-slate-100 rounded-lg text-[10px] py-1">
                          In: <span className="font-extrabold text-content-main">{rec.checkIn || "--:--"}</span>
                        </div>
                        <div className="bg-slate-50 px-2 border border-slate-100 rounded-lg text-[10px] py-1">
                          Out: {isOnDuty ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 animate-pulse">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              On Duty
                            </span>
                          ) : (
                            <span className="font-extrabold text-content-main">{rec.checkOut || "--:--"}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-content-secondary font-mono font-bold">
                      {isOnDuty ? "Active Shift" : (rec.formattedDuration || "--")}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEditTimesheet(rec.userId)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600 rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onDrillHistory(rec.userId)}
                          className="p-1.5 bg-brand-subtle text-brand-accent hover:bg-brand-accent hover:text-white rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}