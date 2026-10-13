"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { X, ChevronDown, Clock, CalendarClock, CheckCircle2, AlertCircle } from "lucide-react";
import { Employee, EmployeeUpdatePayload } from "./EmployeeTable";
import { addCalendarMonths, durationMonthsOrDefault, parseValidDate } from "@/lib/employment-period";

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  errorMessage?: string | null;
  departments?: string[];
  onSave: (id: string | number, data: EmployeeUpdatePayload) => Promise<void>;
}

const STATUSES = ["Active", "On Leave", "Inactive", "Terminated"];
const EMPLOYMENT_TYPES = ["Probation", "Internship", "Permanent", "Contract"];
const DURATION_MONTHS = [
  { value: 1, label: "1 Month" },
  { value: 2, label: "2 Months" },
  { value: 3, label: "3 Months (Standard)" },
  { value: 6, label: "6 Months" },
];
const EXTENSION_MONTHS = [
  { value: 1, label: "Extend by 1 Month" },
  { value: 2, label: "Extend by 2 Months" },
  { value: 3, label: "Extend by 3 Months" },
];

function formatPeriodDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dateKey(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = parseValidDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
}

// Custom SweetAlert2 Toast configuration matching the purple design token schema
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

export default function EditEmployeeModal({
  isOpen,
  onClose,
  employee,
  departments = [],
  onSave,
}: EditEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    designation: "",
    joinDate: "",
    salary: "",
    department: "",
    status: "Active",
    employmentType: "Probation",
    durationMonths: 3,
  });

  // Lifecycle & Extension Action State
  const [reviewAction, setReviewAction] = useState<"NONE" | "EXTEND" | "CONFIRM">("NONE");
  const [extendMonths, setExtendMonths] = useState<number>(1); // 1 or 2 months
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionError, setExtensionError] = useState<string | null>(null);

  // Admin-configured departments
  const departmentOptions = useMemo(() => {
    const configured = departments.filter((dept) => dept.trim().length > 0);
    const current = employee?.department?.trim();
    if (current && !configured.includes(current)) {
      return [current, ...configured];
    }
    return configured;
  }, [departments, employee?.department]);

  // Dropdown states
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isDurationOpen, setIsDurationOpen] = useState(false);
  const [isExtensionOpen, setIsExtensionOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for outside click tracking
  const deptRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);
  const extensionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (deptRef.current && !deptRef.current.contains(target)) setIsDeptOpen(false);
      if (statusRef.current && !statusRef.current.contains(target)) setIsStatusOpen(false);
      if (typeRef.current && !typeRef.current.contains(target)) setIsTypeOpen(false);
      if (durationRef.current && !durationRef.current.contains(target)) setIsDurationOpen(false);
      if (extensionRef.current && !extensionRef.current.contains(target)) setIsExtensionOpen(false);
    }

    if (isDeptOpen || isStatusOpen || isTypeOpen || isDurationOpen || isExtensionOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDeptOpen, isStatusOpen, isTypeOpen, isDurationOpen, isExtensionOpen]);

  // Sync state from props when modal opens or employee changes
  const [prevEmployee, setPrevEmployee] = useState<Employee | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  if (employee !== prevEmployee || isOpen !== prevIsOpen) {
    setPrevEmployee(employee);
    setPrevIsOpen(isOpen);

    if (employee && isOpen) {
      const rawDate =
        employee.joinDate ||
        employee.joiningDate ||
        employee.startDate ||
        employee.createdAt ||
        "";
      let formattedDate = "";
      if (rawDate) {
        const parsedDate = new Date(rawDate);
        if (!isNaN(parsedDate.getTime())) {
          formattedDate = parsedDate.toISOString().split("T")[0];
        }
      }

      const rawSalary =
        employee.salary !== undefined && employee.salary !== null
          ? employee.salary
          : employee.basicSalary || employee.baseSalary;
      const salaryString = rawSalary !== undefined && rawSalary !== null ? String(rawSalary) : "";

      setFormData({
        name: employee.name || "",
        email: employee.email || "",
        designation: employee.designation || employee.role || "",
        joinDate: formattedDate,
        salary: salaryString,
        department: employee.department || departmentOptions[0] || "",
        status: employee.status || "Active",
        employmentType: employee.employmentType || "Probation",
        durationMonths: employee.lifecycleDurationMonths || 3,
      });

      // Reset review actions
      setReviewAction("NONE");
      setExtendMonths(1);
      setExtensionReason("");
      setExtensionError(null);
      setIsDeptOpen(false);
      setIsStatusOpen(false);
      setIsTypeOpen(false);
      setIsDurationOpen(false);
      setIsExtensionOpen(false);
    }
  }

  // Information from employee
  const rawEndDate =
    employee?.periodEndDate ||
    employee?.probationEndDate ||
    employee?.internshipEndDate;
  const storedEndDate = parseValidDate(rawEndDate);

  const isEligibleForReview =
    formData.employmentType === "Internship" || formData.employmentType === "Probation";

  const savedDuration =
    typeof employee?.lifecycleDurationMonths === "number" ? employee.lifecycleDurationMonths : null;
  const selectedDuration = durationMonthsOrDefault(Number(formData.durationMonths));
  const durationChanged =
    savedDuration === null
      ? selectedDuration !== durationMonthsOrDefault(null)
      : selectedDuration !== savedDuration;
  const savedJoinKey = dateKey(
    employee?.joinDate || employee?.joiningDate || employee?.startDate || employee?.createdAt
  );
  const joinChanged = Boolean(formData.joinDate) && savedJoinKey !== formData.joinDate;
  const scheduleChanged = durationChanged || joinChanged;

  const calculatedEndDate = useMemo(() => {
    if (!isEligibleForReview || !formData.joinDate) return null;
    const joinDate = new Date(`${formData.joinDate}T00:00:00`);
    if (Number.isNaN(joinDate.getTime())) return null;
    return addCalendarMonths(joinDate, selectedDuration);
  }, [formData.joinDate, isEligibleForReview, selectedDuration]);

  const reviewEndDate =
    storedEndDate && !scheduleChanged ? storedEndDate : calculatedEndDate;
  const isDueReview = Boolean(
    isEligibleForReview &&
      ((employee?.reviewStatus === "Due Review" && !scheduleChanged) ||
        (reviewEndDate && reviewEndDate.getTime() <= Date.now()))
  );

  const expectedEndDate = useMemo(() => {
    if (!isEligibleForReview || !calculatedEndDate) return null;
    if (reviewAction === "EXTEND" && isDueReview) {
      const extendBase = storedEndDate ?? calculatedEndDate;
      const base = extendBase.getTime() < Date.now() ? new Date() : extendBase;
      return addCalendarMonths(base, extendMonths);
    }
    return calculatedEndDate;
  }, [
    calculatedEndDate,
    extendMonths,
    isDueReview,
    isEligibleForReview,
    reviewAction,
    storedEndDate,
  ]);

  const currentEndLabel = storedEndDate
    ? formatPeriodDate(storedEndDate)
    : calculatedEndDate
      ? formatPeriodDate(calculatedEndDate)
      : null;
  const expectedEndLabel = expectedEndDate ? formatPeriodDate(expectedEndDate) : null;
  const showExpectedChange = Boolean(
    expectedEndLabel && currentEndLabel && expectedEndLabel !== currentEndLabel
  );

  if (!isOpen || !employee) return null;

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.designation) return;

    // Validate reason if HR chooses to extend
    if (reviewAction === "EXTEND" && !extensionReason.trim()) {
      setExtensionError("Please provide a reason for the extension.");
      return;
    }

    setExtensionError(null);

    const updatedPayload: EmployeeUpdatePayload = {
      ...formData,
      salary: formData.salary === "" ? null : Number(formData.salary),
      durationMonths: Number(formData.durationMonths),
      reviewAction,
    };

    // Attach extension or confirmation payload
    if (reviewAction === "EXTEND") {
      updatedPayload.extendMonths = Number(extendMonths);
      updatedPayload.extensionReason = extensionReason.trim();
    } else if (reviewAction === "CONFIRM") {
      updatedPayload.employmentType = "Permanent";
      updatedPayload.confirmationReason = extensionReason.trim() || "Confirmed permanent by HR";
    }

    setIsSubmitting(true);
    try {
      await onSave(employee.id, updatedPayload);
      onClose();

      Toast.fire({
        icon: "success",
        title: "Profile updated successfully",
        customClass: {
          popup: "bg-white border border-[#e2e0e8] rounded-2xl shadow-xl p-4 font-sans text-xs",
          title: "text-xs font-bold text-[#181124]",
        },
      });
    } catch (error) {
      console.error(error);
      const errorText =
        error instanceof Error
          ? error.message
          : "Could not save the employee details. Please try again.";
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: errorText,
        confirmButtonColor: "#7c3aed",
        customClass: {
          popup: "bg-white rounded-2xl border border-[#e2e0e8] shadow-xl font-sans",
          title: "text-sm font-bold text-[#181124]",
          htmlContainer: "text-xs text-[#534a60]",
          confirmButton:
            "px-4.5 py-2.5 text-xs font-bold rounded-xl text-white bg-brand-accent hover:bg-brand-hover border-none outline-none",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClass = () => {
    return "w-full px-3.5 py-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main placeholder-content-muted transition-all duration-200 shadow-sm outline-none hover:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs transition-opacity z-10"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-surface-card border border-line-subtle rounded-2xl max-w-lg w-full p-6 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Purple accent line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-brand-accent to-brand-hover" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line-subtle shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-content-main tracking-tight">
                Edit Employee Profile
              </h2>
              {isDueReview && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 animate-pulse">
                  Due Review
                </span>
              )}
            </div>
            <p className="text-[11px] text-content-secondary mt-0.5 font-medium">
              Modify details, track review dates, or extend probation/internship.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-brand-accent hover:bg-brand-subtle transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 mt-4 space-y-3.5">
          {/* Due Review Alert Box */}
          {isDueReview && (
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[11px]">Period Completed / Due Review</p>
                <p className="text-[10px] text-amber-700/90 mt-0.5">
                  This employee completed their {formData.employmentType} period
                  {currentEndLabel ? ` on ${currentEndLabel}` : ""}. You can extend or confirm them below.
                </p>
              </div>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              className={getInputClass()}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
              Email Address
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              className={getInputClass()}
            />
          </div>

          {/* Designation */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
              Designation
            </label>
            <input
              type="text"
              required
              value={formData.designation}
              onChange={(e) => handleFieldChange("designation", e.target.value)}
              className={getInputClass()}
            />
          </div>

          {/* Grid Layout: Join Date, Salary, Department, Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Join Date
              </label>
              <input
                type="date"
                required
                value={formData.joinDate}
                onChange={(e) => handleFieldChange("joinDate", e.target.value)}
                className={`${getInputClass()} cursor-pointer`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Salary (Rs)
              </label>
              <input
                type="number"
                required
                min="0"
                step="1"
                placeholder="e.g. 80000"
                value={formData.salary}
                onChange={(e) => handleFieldChange("salary", e.target.value)}
                className={getInputClass()}
              />
            </div>

            {/* Department Dropdown */}
            <div className="space-y-1.5 relative" ref={deptRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Department
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsDeptOpen(!isDeptOpen);
                  setIsStatusOpen(false);
                  setIsTypeOpen(false);
                }}
                className={`${getInputClass()} flex items-center justify-between text-left cursor-pointer z-40 relative`}
              >
                <span>{formData.department}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                    isDeptOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDeptOpen && (
                <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 max-h-40 overflow-y-auto">
                  {departmentOptions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-content-muted">
                      No departments configured.
                    </div>
                  ) : (
                    departmentOptions.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => {
                          handleFieldChange("department", dept);
                          setIsDeptOpen(false);
                        }}
                        className={`dropdown-option ${
                          formData.department === dept ? "dropdown-option-active" : ""
                        }`}
                      >
                        {dept}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="space-y-1.5 relative" ref={statusRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Status
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  setIsDeptOpen(false);
                  setIsTypeOpen(false);
                }}
                className={`${getInputClass()} flex items-center justify-between text-left cursor-pointer z-40 relative`}
              >
                <span>{formData.status}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                    isStatusOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isStatusOpen && (
                <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        handleFieldChange("status", status);
                        setIsStatusOpen(false);
                      }}
                      className={`dropdown-option ${
                        formData.status === status ? "dropdown-option-active" : ""
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Employment Type Dropdown */}
          <div className="space-y-1.5 relative" ref={typeRef}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
              Employment Type
            </label>
            <button
              type="button"
              onClick={() => {
                setIsTypeOpen(!isTypeOpen);
                setIsDeptOpen(false);
                setIsStatusOpen(false);
              }}
              className={`${getInputClass()} flex items-center justify-between text-left font-semibold cursor-pointer z-30 relative`}
            >
              <span>{formData.employmentType}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                  isTypeOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isTypeOpen && (
              <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 z-40">
                {EMPLOYMENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      if (
                        type === "Permanent" &&
                        ["Internship", "Probation"].includes(employee.employmentType || "")
                      ) {
                        if (isDueReview) {
                          setReviewAction("CONFIRM");
                          setExtensionError(null);
                        } else {
                          setExtensionError(
                            "This employee can become Permanent only after the period is due for review."
                          );
                        }
                        setIsTypeOpen(false);
                        return;
                      }

                      handleFieldChange("employmentType", type);
                      setIsTypeOpen(false);
                    }}
                    className={`dropdown-option ${
                      formData.employmentType === type ? "dropdown-option-active" : ""
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
            {extensionError && !isDueReview && (
              <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                {extensionError}
              </p>
            )}
          </div>

          {isEligibleForReview && (
            <div className="space-y-1.5 relative" ref={durationRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-accent block flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                Period Duration
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsDurationOpen(!isDurationOpen);
                  setIsDeptOpen(false);
                  setIsStatusOpen(false);
                  setIsTypeOpen(false);
                  setIsExtensionOpen(false);
                }}
                className={`${getInputClass()} flex items-center justify-between text-left cursor-pointer font-semibold`}
              >
                <span>
                  {DURATION_MONTHS.find(
                    (option) => option.value === Number(formData.durationMonths)
                  )?.label}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                    isDurationOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isDurationOpen && (
                <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 z-50">
                  {DURATION_MONTHS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        handleFieldChange("durationMonths", String(option.value));
                        setIsDurationOpen(false);
                      }}
                      className={`dropdown-option ${
                        Number(formData.durationMonths) === option.value
                          ? "dropdown-option-active"
                          : ""
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-content-secondary">
                Updating this value recalculates the review date from the join date.
              </p>
            </div>
          )}

          {/* LIFECYCLE / EXTENSION ACTIONS (Only for Probation & Internship) */}
          {isEligibleForReview && (
            <div className="p-3.5 rounded-xl border border-line-subtle bg-surface-main/60 space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-content-main flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-brand-accent" />
                    Review & Period Actions
                  </h4>
                  {(currentEndLabel || expectedEndLabel) && (
                    <p className="text-[10px] text-content-secondary mt-0.5">
                      Current End Date:{" "}
                      <span className="font-bold text-content-main">
                        {currentEndLabel || "Not set"}
                      </span>
                      {showExpectedChange && (
                        <>
                          {" · "}
                          <span className="font-semibold text-content-secondary">
                            Expected After Changes:{" "}
                          </span>
                          <span className="font-bold text-content-main">{expectedEndLabel}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Review actions are available only after the period is due. */}
              {isDueReview && <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReviewAction("NONE");
                    setExtensionError(null);
                  }}
                  className={`p-2 rounded-lg border text-[11px] font-semibold transition ${
                    reviewAction === "NONE"
                      ? "bg-surface-card border-brand-accent text-brand-accent shadow-xs"
                      : "border-line-subtle text-content-muted hover:bg-surface-card"
                  }`}
                >
                  No Change
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction("EXTEND")}
                  className={`p-2 rounded-lg border text-[11px] font-semibold transition flex items-center justify-center gap-1.5 ${
                    reviewAction === "EXTEND"
                      ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 font-bold"
                      : "border-line-subtle text-content-muted hover:bg-surface-card"
                  }`}
                >
                  Extend Period
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReviewAction("CONFIRM");
                    setExtensionError(null);
                  }}
                  className={`p-2 rounded-lg border text-[11px] font-semibold transition flex items-center justify-center gap-1.5 ${
                    reviewAction === "CONFIRM"
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold"
                      : "border-line-subtle text-content-muted hover:bg-surface-card"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Make Permanent
                </button>
              </div>}

              {/* IF EXTEND SELECTED: Duration & Mandatory Reason */}
              {isDueReview && reviewAction === "EXTEND" && (
                <div className="space-y-2.5 pt-2 border-t border-line-subtle">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-content-muted">
                      Extend Duration
                    </label>
                    <div className="relative" ref={extensionRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsExtensionOpen(!isExtensionOpen);
                          setIsDeptOpen(false);
                          setIsStatusOpen(false);
                          setIsTypeOpen(false);
                          setIsDurationOpen(false);
                        }}
                        className="w-full px-3.5 py-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent cursor-pointer flex items-center justify-between text-left"
                      >
                        <span>
                          {EXTENSION_MONTHS.find((option) => option.value === extendMonths)?.label}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                            isExtensionOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isExtensionOpen && (
                        <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 z-50">
                          {EXTENSION_MONTHS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setExtendMonths(option.value);
                                setIsExtensionOpen(false);
                              }}
                              className={`dropdown-option ${
                                extendMonths === option.value ? "dropdown-option-active" : ""
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-content-muted">
                      Reason for Extension <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Requires additional mentoring on backend architectures before confirmation."
                      value={extensionReason}
                      onChange={(e) => {
                        setExtensionReason(e.target.value);
                        if (extensionError) setExtensionError(null);
                      }}
                      className="w-full p-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main outline-none focus:border-brand-accent resize-none"
                    />
                    {extensionError && (
                      <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3" />
                        {extensionError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* IF CONFIRM SELECTED */}
              {reviewAction === "CONFIRM" && (
                <div className="space-y-1 pt-2 border-t border-line-subtle">
                  <label className="text-[10px] font-bold uppercase text-content-muted">
                    Confirmation Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Successfully met all KPIs and objectives."
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main outline-none focus:border-brand-accent"
                  />
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end items-center gap-2 pt-3 border-t border-line-subtle shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4.5 py-2.5 text-xs font-bold text-content-secondary bg-surface-main hover:bg-brand-subtle hover:text-brand-accent rounded-xl border border-line-subtle transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4.5 py-2.5 text-xs font-bold text-white bg-brand-accent hover:bg-brand-hover rounded-xl shadow-xs hover:shadow-md transition duration-150 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}