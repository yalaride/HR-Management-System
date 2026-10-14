"use client";

import React, { useState } from "react";
import Swal from "sweetalert2";
import {
  Clock,
  History,
  Calendar,
  X,
  Trash2,
} from "lucide-react";
import { Employee } from "./EmployeeTable";

interface ViewEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onDelete: (id: string | number) => Promise<void>;
}

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

export default function ViewEmployeeModal({
  isOpen,
  onClose,
  employee,
  onDelete,
}: ViewEmployeeModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !employee) return null;

  const rawJoinDate =
    employee.joinDate || employee.joiningDate || employee.startDate || employee.createdAt;
  let formattedJoinDate = "—";
  if (rawJoinDate) {
    const parsedDate = new Date(rawJoinDate);
    if (!isNaN(parsedDate.getTime())) {
      formattedJoinDate = parsedDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }

  const rawSalary =
    employee.salary !== undefined && employee.salary !== null
      ? employee.salary
      : employee.basicSalary || employee.baseSalary;

  let formattedSalary = "—";
  if (rawSalary !== undefined && rawSalary !== null && rawSalary !== "") {
    const numericSalary = Number(rawSalary);
    if (!isNaN(numericSalary)) {
      formattedSalary = new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 0,
      }).format(numericSalary);
    }
  }

  // Format End Date / Confirmation Date
  const formatDate = (dateValue?: string | Date | null) => {
    if (!dateValue) return "—";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isDueReview = employee.reviewStatus === "Due Review";
  const empType = employee.employmentType || "Permanent";
  const extensions = employee.extensions || [];

  const handleDeleteClick = async () => {
    const result = await Swal.fire({
      title: "Delete Employee Profile?",
      text: `Are you sure you want to permanently delete ${employee.name}? This will remove their registration and credential access.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete profile",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: "bg-white border border-slate-150 rounded-2xl shadow-xl p-6 font-sans text-center",
        title: "text-base font-bold text-slate-900",
        htmlContainer: "text-xs text-slate-500 mt-2 leading-relaxed",
        actions: "flex gap-2 justify-center mt-5 w-full",
        confirmButton:
          "px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer",
        cancelButton:
          "px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer",
      },
    });

    if (result.isConfirmed) {
      setIsDeleting(true);
      try {
        await onDelete(employee.id);
        onClose();

        Toast.fire({
          icon: "success",
          title: "Employee record removed",
          customClass: {
            popup: "bg-white border border-slate-100 rounded-2xl shadow-xl p-4 font-sans text-xs",
            title: "text-xs font-bold text-slate-900",
          },
        });
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Could not remove the profile from the database. Please try again.",
          confirmButtonColor: "#4f46e5",
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-950">Employee Details & Lifecycle</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Profile details, probation/internship timeline, and extension logs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-5 py-4 overflow-y-auto pr-1 flex-1">
          {/* Profile Overview */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="h-13 w-13 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm uppercase overflow-hidden shrink-0">
              {(() => {
                const imageUrl =
                  employee.image ||
                  employee.picture ||
                  employee.profilePicture ||
                  employee.profilePhotoUrl ||
                  employee.profilePhotoURL;

                const initials = employee.name
                  ? employee.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                  : "EE";

                if (!imageUrl) return initials;

                return (
                  <img
                    src={imageUrl}
                    alt={employee.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                );
              })()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{employee.name}</h3>
              <p className="text-xs text-indigo-600 font-medium capitalize">
                {employee.designation || employee.role}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{employee.email}</p>
            </div>
          </div>

          {/* Due Review Alert if completed */}
          {isDueReview && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Period Complete — Review Pending</span>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  This employee’s {empType} duration has finished. HR needs to extend or confirm them as Permanent in the Edit modal.
                </p>
              </div>
            </div>
          )}

          {/* General Information Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl text-xs">
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Department
              </span>
              <span className="font-semibold text-slate-700">{employee.department || "—"}</span>
            </div>

            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Fingerprint No.
              </span>
              <span className="font-semibold text-slate-700">{employee.deviceUserNo || "—"}</span>
            </div>

            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                System Status
              </span>
              <span
                className={`inline-flex mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  employee.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {employee.status || "Inactive"}
              </span>
            </div>

            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Employment Type
              </span>
              <span className="font-bold text-indigo-700 capitalize">{empType}</span>
            </div>

            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Join Date
              </span>
              <span className="font-semibold text-slate-700">{formattedJoinDate}</span>
            </div>

            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Salary
              </span>
              <span className="font-semibold text-slate-700">{formattedSalary}</span>
            </div>

            {/* Target End Date or Permanent Confirmation */}
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                {empType === "Permanent" ? "Confirmed Date" : "Period End Date"}
              </span>
              <span className="font-semibold text-slate-700">
                {empType === "Permanent"
                  ? formatDate(employee.confirmationDate)
                  : formatDate(employee.periodEndDate)}
              </span>
            </div>
          </div>

          {/* EXTENSION HISTORY & REASONS LOG */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                Extension History & Reasons ({extensions.length})
              </h4>
            </div>

            {extensions.length === 0 ? (
              <div className="p-3.5 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                No extensions recorded. Employee is progressing under original term.
              </div>
            ) : (
              <div className="space-y-2.5">
                {extensions.map((ext, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          +{ext.durationMonths} {ext.durationMonths === 1 ? "Month" : "Months"}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-800">
                          {ext.stage || ext.type || empType} Extension
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(ext.extendedAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                          Previous Target
                        </span>
                        <span className="font-medium text-slate-700">
                          {formatDate(ext.previousEndDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                          New Target
                        </span>
                        <span className="font-bold text-indigo-700">
                          {formatDate(ext.newEndDate)}
                        </span>
                      </div>
                    </div>

                    {/* Extension Reason */}
                    <div className="pt-1.5 border-t border-slate-100">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                        Reason for Extension
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-150 leading-relaxed italic">
                        &quot;{ext.reason}&quot;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? "Deleting..." : "Delete Profile"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}