"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import PasswordInputWithToggle from "../../PasswordInputWithToggle";
import { AlertTriangle, ChevronDown, X, CalendarClock, Info } from "lucide-react";

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage?: string | null;
  onSave: (data: {
    name: string;
    email: string;
    password: string;
    department: string;
    status: string;
    designation: string;
    salary: number;
    joinDate: string;
    employmentType: string;
    durationMonths: number;
    deviceUserNo: string;
  }) => Promise<boolean | void> | boolean | void;
  departments?: string[];
}

const STATUSES = ["Active", "On Leave"];
const EMPLOYMENT_TYPES = ["Probation", "Internship", "Permanent", "Contract"];
const DURATION_MONTHS = [
  { value: 1, label: "1 Month" },
  { value: 2, label: "2 Months" },
  { value: 3, label: "3 Months (Standard)" },
  { value: 6, label: "6 Months" },
];

const getInitialFormData = () => ({
  name: "",
  email: "",
  password: "",
  department: "",
  designation: "",
  deviceUserNo: "",
  salary: "" as string | number,
  joinDate: new Date().toISOString().split("T")[0],
  status: "Active",
  employmentType: "Probation",
  durationMonths: 3,
});

// Capture the current timestamp once at module level to avoid calling Date.now() during render
const _NOW_REF = { current: Date.now() };

export default function AddEmployeeModal({
  isOpen,
  onClose,
  onSave,
  errorMessage,
  departments = [],
}: AddEmployeeModalProps) {
  const [formData, setFormData] = useState(getInitialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isDurationOpen, setIsDurationOpen] = useState(false);

  const deptRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData(getInitialFormData());
    setErrors({});
    setGeneralError(null);
    setIsDeptOpen(false);
    setIsStatusOpen(false);
    setIsTypeOpen(false);
    setIsDurationOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Safe local date parsing to avoid UTC midnight shifts
  const parseLocalDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  const isToday = (dateValue = formData.joinDate) => {
    if (!dateValue) return false;
    const parsed = parseLocalDate(dateValue);
    if (!parsed) return false;
    const now = new Date();
    return (
      parsed.getFullYear() === now.getFullYear() &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getDate() === now.getDate()
    );
  };

  const showDuration =
    formData.employmentType === "Probation" || formData.employmentType === "Internship";

  // Calculate the projected trial end date
  const lifecycleEndDate = useMemo(() => {
    if (!formData.joinDate || !showDuration) return null;
    const start = parseLocalDate(formData.joinDate);
    if (!start) return null;

    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(formData.durationMonths));
    return end;
  }, [formData.joinDate, formData.durationMonths, showDuration]);

  const isPeriodInPast = useMemo(() => {
    if (!lifecycleEndDate) return false;
    return lifecycleEndDate.getTime() <= _NOW_REF.current;
  }, [lifecycleEndDate]);

  const formattedEndDate = useMemo(() => {
    if (!lifecycleEndDate) return "";
    return lifecycleEndDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [lifecycleEndDate]);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (deptRef.current && !deptRef.current.contains(target)) setIsDeptOpen(false);
      if (statusRef.current && !statusRef.current.contains(target)) setIsStatusOpen(false);
      if (typeRef.current && !typeRef.current.contains(target)) setIsTypeOpen(false);
      if (durationRef.current && !durationRef.current.contains(target)) setIsDurationOpen(false);
    }

    if (isDeptOpen || isStatusOpen || isTypeOpen || isDurationOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDeptOpen, isStatusOpen, isTypeOpen, isDurationOpen]);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (
        field === "joinDate" &&
        isToday(String(value)) &&
        next.employmentType === "Permanent"
      ) {
        next.employmentType = "Probation";
      }
      return next;
    });

    if (errors[field]) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[field];
        return nextErrors;
      });
    }

    if (generalError) {
      setGeneralError(null);
    }
  };

  const validateForm = (): boolean => {
    const tempErrors: Record<string, string> = {};

    if (!formData.name.trim()) tempErrors.name = "Full name is required";

    if (!formData.email.trim()) {
      tempErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      tempErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      tempErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      tempErrors.password = "Password must be at least 6 characters long";
    }

    if (!formData.designation.trim()) {
      tempErrors.designation = "Designation is required";
    }

    const fingerprint = formData.deviceUserNo.trim();
    if (fingerprint && !/^\d{1,12}$/.test(fingerprint)) {
      tempErrors.deviceUserNo = "Use the device number only, like 14, 15, or 16.";
    } else if (fingerprint && fingerprint.replace(/^0+/, "") === "") {
      tempErrors.deviceUserNo = "Fingerprint number must be greater than 0.";
    }

    if (!formData.department) {
      tempErrors.department = "Department is required";
    }

    if (!formData.joinDate) {
      tempErrors.joinDate = "Join date is required";
    } else {
      const parsed = parseLocalDate(formData.joinDate);
      if (parsed && parsed.getTime() > Date.now()) {
        tempErrors.joinDate = "Join date cannot be in the future";
      }
    }

    // Trial period past validation (e.g. 2025 join date + 3 months)
    let lifecycleError: string | null = null;
    if (showDuration && isPeriodInPast && formattedEndDate) {
      lifecycleError = `${formData.employmentType} cannot be assigned because its ${formData.durationMonths}-month period ended on ${formattedEndDate}. Please select Permanent or Contract.`;
      tempErrors.joinDate = lifecycleError;
      tempErrors.employmentType = lifecycleError;
    }

    const salaryNum = Number(formData.salary);
    if (formData.salary === "" || isNaN(salaryNum) || salaryNum < 0) {
      tempErrors.salary = "Please specify a valid positive salary";
    }

    setErrors(tempErrors);

    if (Object.keys(tempErrors).length > 0) {
      setGeneralError(lifecycleError || "Please correct the highlighted errors before saving.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await onSave({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        department: formData.department,
        status: formData.status,
        designation: formData.designation.trim(),
        deviceUserNo: formData.deviceUserNo.trim(),
        salary: Number(formData.salary) || 0,
        joinDate: formData.joinDate,
        employmentType: formData.employmentType,
        durationMonths:
          formData.employmentType === "Permanent" || formData.employmentType === "Contract"
            ? 0
            : Number(formData.durationMonths),
      });

      // ONLY clear form if save succeeded (result === true or not explicitly false)
      if (result !== false) {
        resetForm();
      }
    } catch {
      // Keep form data on error so user does not lose typed input
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClass = (fieldName: string) => {
    const baseClass =
      "w-full px-3.5 py-2.5 bg-surface-card border rounded-xl text-xs text-content-main placeholder-content-muted transition-all duration-200 shadow-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed";
    const normalClass =
      "border-line-subtle hover:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent";
    const errorClass =
      "border-rose-300 bg-rose-50/10 text-rose-900 hover:border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500";

    return `${baseClass} ${errors[fieldName] ? errorClass : normalClass}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs transition-opacity z-10"
        onClick={handleClose}
      />

      <div className="relative bg-surface-card border border-line-subtle rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-brand-accent to-brand-hover" />

        <div className="flex items-start justify-between pb-4 border-b border-line-subtle shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-content-main tracking-tight">
              Add New Employee
            </h2>
            <p className="text-[11px] text-content-secondary mt-0.5 font-medium">
              Configure initial details, employment type, and trial period.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-brand-accent hover:bg-brand-subtle transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 -mr-1 mt-4 space-y-4">
          {/* Error Banner */}
          {(generalError || errorMessage) && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50/75 border border-rose-200 rounded-xl text-rose-800 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold">
                  {errorMessage && !generalError ? "Submission Notice" : "Validation Notice"}
                </h4>
                <p className="text-[11px] text-rose-700 mt-0.5 font-medium leading-relaxed">
                  {generalError || errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Real-time Inline Notice if Period is already in past */}
          {showDuration && isPeriodInPast && formattedEndDate && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl text-amber-900 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Period ended on {formattedEndDate}: </span>
                Since this {formData.employmentType.toLowerCase()} period has already concluded,
                please select <span className="font-semibold underline">Permanent</span> or{" "}
                <span className="font-semibold underline">Contract</span> for this employee.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
            {/* Full Name */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Liam Parker"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={getInputClass("name")}
              />
              {errors.name && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.name}</p>
              )}
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={getInputClass("email")}
              />
              {errors.email && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.email}</p>
              )}
            </div>

            {/* Temp Password */}
            <div className="space-y-1.5">
              <PasswordInputWithToggle
                label="Temp Password"
                value={formData.password}
                onChange={(next) => handleInputChange("password", next)}
                placeholder="Minimum 6 characters"
                inputClassName={getInputClass("password")}
              />
              {errors.password && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.password}</p>
              )}
            </div>

            {/* Designation */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Designation
              </label>
              <input
                type="text"
                placeholder="e.g. Frontend Engineer"
                value={formData.designation}
                onChange={(e) => handleInputChange("designation", e.target.value)}
                className={getInputClass("designation")}
              />
              {errors.designation && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.designation}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Fingerprint No.
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Same number as the device, e.g. 15"
                value={formData.deviceUserNo}
                onChange={(e) => handleInputChange("deviceUserNo", e.target.value)}
                className={getInputClass("deviceUserNo")}
              />
              <p className="text-[10px] text-content-muted">
                The unique number the fingerprint machine shows for this person.
              </p>
              {errors.deviceUserNo && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.deviceUserNo}</p>
              )}
            </div>

            {/* Department */}
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
                  setIsDurationOpen(false);
                }}
                className={`${getInputClass("department")} flex items-center justify-between text-left cursor-pointer z-40 relative`}
              >
                <span>{formData.department || "Select Department"}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                    isDeptOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDeptOpen && (
                <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 max-h-44 overflow-y-auto z-50">
                  {departments.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-content-muted">
                      No departments configured.
                    </div>
                  ) : (
                    departments.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => {
                          handleInputChange("department", dept);
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
              {errors.department && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.department}</p>
              )}
            </div>

            {/* Salary */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Salary (Rs)
              </label>
              <input
                type="number"
                min={0}
                step="1"
                placeholder="e.g. 80000"
                value={formData.salary}
                onChange={(e) => handleInputChange("salary", e.target.value)}
                className={getInputClass("salary")}
              />
              {errors.salary && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.salary}</p>
              )}
            </div>

            {/* Join Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Join Date
              </label>
              <input
                type="date"
                value={formData.joinDate}
                onChange={(e) => handleInputChange("joinDate", e.target.value)}
                className={`${getInputClass("joinDate")} cursor-pointer`}
              />
              {errors.joinDate && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.joinDate}</p>
              )}
            </div>

            {/* Initial Status */}
            <div className="space-y-1.5 relative" ref={statusRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Initial Status
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  setIsDeptOpen(false);
                  setIsTypeOpen(false);
                  setIsDurationOpen(false);
                }}
                className={`${getInputClass("status")} flex items-center justify-between text-left cursor-pointer z-40 relative`}
              >
                <span>{formData.status}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                    isStatusOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isStatusOpen && (
                <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 z-50">
                  {STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        handleInputChange("status", status);
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

            {/* Employment Type */}
            <div className="space-y-1.5 relative" ref={typeRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-accent block">
                Employment Type
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsTypeOpen(!isTypeOpen);
                  setIsDeptOpen(false);
                  setIsStatusOpen(false);
                  setIsDurationOpen(false);
                }}
                className={`${getInputClass("employmentType")} flex items-center justify-between text-left cursor-pointer z-40 relative font-semibold`}
              >
                <span>{formData.employmentType}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                    isTypeOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isTypeOpen && (
                <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 z-50">
                  {EMPLOYMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={type === "Permanent" && isToday()}
                      onClick={() => {
                        if (type === "Permanent" && isToday()) return;
                        handleInputChange("employmentType", type);
                        setIsTypeOpen(false);
                      }}
                      className={`dropdown-option ${
                        type === "Permanent" && isToday()
                          ? "cursor-not-allowed opacity-50"
                          : ""
                      } ${
                        formData.employmentType === type ? "dropdown-option-active" : ""
                      }`}
                    >
                      {type}
                      {type === "Permanent" && isToday()
                        ? " (Not allowed for today's join date)"
                        : ""}
                    </button>
                  ))}
                </div>
              )}
              {errors.employmentType && (
                <p className="text-[10px] text-rose-500 font-semibold">{errors.employmentType}</p>
              )}
            </div>

            {/* Trial Duration (Conditional for Probation / Internship) */}
            {showDuration && (
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
                  }}
                  className={`${getInputClass("durationMonths")} flex items-center justify-between text-left cursor-pointer relative font-semibold`}
                >
                  <span>
                    {DURATION_MONTHS.find((option) => option.value === formData.durationMonths)?.label}
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
                          handleInputChange("durationMonths", option.value);
                          setIsDurationOpen(false);
                        }}
                        className={`dropdown-option ${
                          formData.durationMonths === option.value
                            ? "dropdown-option-active"
                            : ""
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end items-center gap-2 pt-4 border-t border-line-subtle shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="px-4.5 py-2.5 text-xs font-bold text-content-secondary bg-surface-main hover:bg-brand-subtle hover:text-brand-accent rounded-xl border border-line-subtle transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4.5 py-2.5 text-xs font-bold text-white bg-brand-accent hover:bg-brand-hover rounded-xl shadow-xs hover:shadow-md transition duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Creating Profile...</span>
                </>
              ) : (
                <span>Create Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}