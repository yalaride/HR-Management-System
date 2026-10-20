"use client";

import React from "react";
import {
  Mail,
  Calendar,
  ExternalLink,
  Edit,
  DollarSign,
  Trash2,
  Loader2,
  Clock,
  History,
} from "lucide-react";

export interface ExtensionRecord {
  type?: string;
  stage?: string;
  previousEndDate: string | Date;
  newEndDate: string | Date;
  durationMonths: number;
  reason: string;
  extendedAt?: string | Date;
}

export interface EmployeeUpdatePayload {
  name: string;
  email: string;
  designation: string;
  joinDate: string;
  salary: number | null;
  department: string;
  status: string;
  employmentType: string;
  durationMonths: number;
  reviewAction: "NONE" | "EXTEND" | "CONFIRM";
  extendMonths?: number;
  extensionReason?: string;
  confirmationReason?: string;
  deviceUserNo?: string;
}

export interface Employee {
  id: number | string;
  name: string;
  role: string;
  email: string;
  department: string;
  status: string;
  designation?: string;
  joinDate?: string | null;
  salary?: number | null;
  hourlyRate?: number | null;
  joiningDate?: string | null;
  startDate?: string | null;
  createdAt?: string | null;
  basicSalary?: number | string | null;
  baseSalary?: number | string | null;
  image?: string;
  picture?: string;
  profilePicture?: string;
  profilePhotoUrl?: string;
  profilePhotoURL?: string;

  // Lifecycle & Extension additions
  employmentType?: string; // "Probation" | "Internship" | "Permanent" | "Contract"
  reviewStatus?: string;   // "Pending" | "Due Review" | "Completed"
  lifecycleDurationMonths?: number | null;
  periodEndDate?: string | null;
  probationEndDate?: string | null;
  internshipEndDate?: string | null;
  confirmationDate?: string | null;
  extensions?: ExtensionRecord[];
  deviceUserNo?: string;
  profileCompletion?: number;
}

interface EmployeeTableProps {
  employees: Employee[];
  onEdit?: (employee: Employee) => void;
  onViewPortal?: (employee: Employee) => void;
  onDelete?: (employee: Employee) => void;
  deletingId?: string | number | null;
}

export default function EmployeeTable({
  employees,
  onEdit,
  onViewPortal,
  onDelete,
  deletingId = null,
}: EmployeeTableProps) {
  const getInitials = (name: string) => {
    return (
      (name || "Employee")
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "??"
    );
  };

  const formatSalary = (amount?: number | null) => {
    if (amount === undefined || amount === null) return "N/A";
    try {
      const formatted = new Intl.NumberFormat("en-PK", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
      return `Rs ${formatted}`;
    } catch {
      return `Rs ${amount}`;
    }
  };

  const formatJoinDate = (value?: string | null) => {
    if (!value) return "N/A";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
    } catch {
      return value;
    }
  };

  const getTypeBadgeClass = (type: string = "Permanent") => {
    switch (type.toLowerCase()) {
      case "internship":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "probation":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "contract":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-4">Employee</th>
              <th className="px-5 py-4">Role & Department</th>
              <th className="px-5 py-4">Type & Review</th>
              <th className="px-5 py-4">Salary</th>
              <th className="px-5 py-4">Join Date</th>
              <th className="px-5 py-4 text-center">Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400">
                  No employee records found.
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const initials = getInitials(emp.name);
                const isStatusActive = String(emp.status).toLowerCase() === "active";
                const displayJoinDate = formatJoinDate(emp.joinDate || emp.joiningDate || null);
                const empType = emp.employmentType || "Permanent";
                const isDueReview = emp.reviewStatus === "Due Review";
                const extensionsCount = emp.extensions?.length || 0;
                const showExtensionBadge =
                  empType.toLowerCase() !== "permanent" && extensionsCount > 0;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition duration-150">
                    {/* Employee Info */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold text-[11px] tracking-wide overflow-hidden shrink-0">
                          {(() => {
                            const imageUrl =
                              emp.image ||
                              emp.picture ||
                              emp.profilePicture ||
                              emp.profilePhotoUrl;

                            if (typeof imageUrl !== "string" || !imageUrl.trim()) return initials;

                            return (
                              <img
                                src={imageUrl}
                                alt={emp.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            );
                          })()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 capitalize block leading-tight truncate">
                            {emp.name}
                          </span>
                          <span
                            className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate"
                            title={emp.email}
                          >
                            <Mail className="w-3 h-3 shrink-0" />
                            {emp.email}
                          </span>
                          {emp.deviceUserNo ? (
                            <span className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                              Fingerprint {emp.deviceUserNo}
                            </span>
                          ) : null}
                          {typeof emp.profileCompletion === "number" && emp.profileCompletion < 100 ? (
                            <span className="text-[10px] font-semibold text-amber-700 mt-0.5">
                              Profile {emp.profileCompletion}%
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Role & Department */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 capitalize leading-tight">
                          {emp.designation || emp.role}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium capitalize mt-0.5">
                          {emp.department}
                        </span>
                      </div>
                    </td>

                    {/* Employment Type & Lifecycle Status */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTypeBadgeClass(
                              empType
                            )}`}
                          >
                            {empType}
                          </span>

                          {isDueReview && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-500/15 border border-amber-500/40 text-amber-700 animate-pulse">
                              <Clock className="w-2.5 h-2.5" />
                              Due Review
                            </span>
                          )}
                        </div>

                        {showExtensionBadge && (
                          <span className="inline-flex items-center gap-1 text-[9px] text-purple-600 font-semibold">
                            <History className="w-2.5 h-2.5" />
                            Extended ({extensionsCount}x)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Salary */}
                    <td className="px-5 py-4 font-semibold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatSalary(emp.salary ?? null)}</span>
                      </div>
                    </td>

                    {/* Join Date */}
                    <td className="px-5 py-4 text-slate-500 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{displayJoinDate}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                            isStatusActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isStatusActive ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          {emp.status}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onEdit?.(emp)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold">Edit</span>
                        </button>
                        <button
                          onClick={() => onViewPortal?.(emp)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold">Details</span>
                        </button>
                        {onDelete && (
                          <button
                            onClick={() => onDelete(emp)}
                            disabled={deletingId === emp.id}
                            title="Delete employee"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === emp.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span className="text-[10px] font-bold">Delete</span>
                          </button>
                        )}
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