"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Calendar, CreditCard, User, AlertTriangle, ChevronDown } from "lucide-react";

export interface EmployeeOption {
  _id?: string;
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  role?: string;
  designation?: string; // from /api/admin/employees
  department?: string;
  status?: string;
}

interface GeneratePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: EmployeeOption[];
  isLoading?: boolean;
  onSave: (data: {
    employeeId: string;
    period: string;
    basicSalary: number;
    allowances: number;
    deductions: number;
    bonus: number;
    tax: number;
    taxMode: "deduct" | "add";
    netPay: number;
    paymentMethod: string;
    paymentDate: string;
  }) => void;
}

const getLocalTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultPeriod = () => {
  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long" });
  const year = now.getFullYear();
  return `${monthName} ${year}`;
};

function periodToMonthInputValue(period: string): string {
  const trimmed = (period || "").trim();
  if (!trimmed) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  const match = trimmed.match(/^([A-Za-z]+)\s+(19\d{2}|20\d{2})$/);
  if (!match) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  const parsed = new Date(`${match[1]} 1, ${match[2]}`);
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function monthInputValueToPeriod(value: string): string {
  const [yearStr, monthStr] = value.split("-");
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  if (Number.isNaN(year) || monthIndex < 0 || monthIndex > 11) return getDefaultPeriod();

  const monthName = new Date(year, monthIndex, 1).toLocaleString("default", { month: "long" });
  return `${monthName} ${year}`;
}

function getMonthInputBounds() {
  const now = new Date();
  const max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const min = `${now.getFullYear() - 10}-01`;
  return { min, max };
}

export default function GeneratePayslipModal({
  isOpen,
  onClose,
  employees = [],
  isLoading = false,
  onSave,
}: GeneratePayslipModalProps) {
  const [formData, setFormData] = useState({
    employeeId: "",
    jobTitle: "",
    period: "",
    basicSalary: 0,
    allowances: 0,
    deductions: 0,
    bonus: 0,
    tax: 0,
    taxMode: "deduct" as "deduct" | "add",
    paymentMethod: "Bank Transfer",
    paymentDate: "",
  });

  const [autoCalculatedValues, setAutoCalculatedValues] = useState({
    basicSalary: 0,
    deductions: 0,
  });

  const [isEmployeeOpen, setIsEmployeeOpen] = useState(false);
  const [isPaymentMethodOpen, setIsPaymentMethodOpen] = useState(false);

  const employeeRef = useRef<HTMLDivElement>(null);
  const paymentMethodRef = useRef<HTMLDivElement>(null);

  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (isOpen) {
      console.log("GeneratePayslipModal received employees list:", employees);
    }
  }, [isOpen, employees]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (employeeRef.current && !employeeRef.current.contains(target)) {
        setIsEmployeeOpen(false);
      }
      if (paymentMethodRef.current && !paymentMethodRef.current.contains(target)) {
        setIsPaymentMethodOpen(false);
      }
    }

    if (isEmployeeOpen || isPaymentMethodOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEmployeeOpen, isPaymentMethodOpen]);

  // Handle auto-calculation whenever Employee or Pay Period changes
  useEffect(() => {
    if (!formData.employeeId || !formData.period) return;

    const fetchCalculation = async () => {
      try {
        const res = await fetch(
          `/api/admin/payslips?action=calculate&employeeId=${formData.employeeId}&period=${encodeURIComponent(formData.period)}`
        );
        if (res.ok) {
          const data = await res.json();
          setAutoCalculatedValues({
            basicSalary: data.basicSalary,
            deductions: data.deductions,
          });
          // Update the inputs automatically
          setFormData((prev) => ({
            ...prev,
            basicSalary: data.basicSalary,
            deductions: data.deductions,
          }));
        }
      } catch (err) {
        console.error("Auto-calculation fetch failed:", err);
      }
    };

    fetchCalculation();
  }, [formData.employeeId, formData.period]);

  // Reset the form during render when the modal transitions to open
  // (official "adjust state when a prop changes" pattern).
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFormData({
        employeeId: "",
        jobTitle: "",
        period: getDefaultPeriod(),
        basicSalary: 0,
        allowances: 0,
        deductions: 0,
        bonus: 0,
        tax: 0,
        taxMode: "deduct",
        paymentMethod: "Bank Transfer",
        paymentDate: getLocalTodayDateString(),
      });
      setAutoCalculatedValues({ basicSalary: 0, deductions: 0 });
      setValidationError("");
      setIsEmployeeOpen(false);
      setIsPaymentMethodOpen(false);
    }
  }

  if (!isOpen) return null;

  const handleEmployeeSelect = (selectedId: string) => {
    const selectedEmployee = (employees || []).find((emp) => {
      if (!emp) return false;
      const empId = emp._id?.toString() || emp.id?.toString() || "";
      return empId === selectedId;
    });

    let combinedJobTitle = "";
    if (selectedEmployee) {
      const title = (selectedEmployee.designation || selectedEmployee.jobTitle || "").trim();
      const role = (selectedEmployee.role || "").trim();

      if (title && role && title.toLowerCase() !== role.toLowerCase()) {
        combinedJobTitle = `${title} / ${role}`;
      } else {
        combinedJobTitle = title || role || "No Specified Title";
      }
    }

    setFormData((prev) => ({
      ...prev,
      employeeId: selectedId,
      jobTitle: combinedJobTitle,
    }));
    setValidationError("");
    setIsEmployeeOpen(false);
  };

  const handleResetToCalculated = () => {
    setFormData((prev) => ({
      ...prev,
      basicSalary: autoCalculatedValues.basicSalary,
      deductions: autoCalculatedValues.deductions,
      allowances: 0,
      bonus: 0,
      tax: 0,
      taxMode: "deduct",
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? 0 : Math.max(0, Number(value))) : value,
    }));
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;
    setFormData((prev) => ({
      ...prev,
      period: monthInputValueToPeriod(value),
    }));
  };

  const taxEffect = formData.taxMode === "add" ? formData.tax : -formData.tax;
  const netPay =
    formData.basicSalary + formData.allowances + formData.bonus - formData.deductions + taxEffect;
  const monthInputBounds = getMonthInputBounds();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId) {
      setValidationError("Please select an employee.");
      return;
    }
    if (formData.basicSalary <= 0) {
      setValidationError("Basic Salary must be greater than Rs 0 to record payment.");
      return;
    }
    if (netPay < 0) {
      setValidationError("Tax and deductions cannot be more than the total earnings.");
      return;
    }

    setValidationError("");

    onSave({
      employeeId: formData.employeeId,
      period: formData.period,
      basicSalary: formData.basicSalary,
      allowances: formData.allowances,
      deductions: formData.deductions,
      bonus: formData.bonus,
      tax: formData.tax,
      taxMode: formData.taxMode,
      netPay,
      paymentMethod: formData.paymentMethod,
      paymentDate: formData.paymentDate,
    });
  };

  const selectedEmployeeObj = (employees || []).find((emp) => {
    if (!emp) return false;
    return (emp._id?.toString() || emp.id?.toString() || "") === formData.employeeId;
  });

  const getEmployeeDisplayLabel = () => {
    if (!selectedEmployeeObj) {
      if (isLoading) return "Loading employees...";
      if ((employees || []).length === 0) return "No employees found";
      return "Select an employee...";
    }

    const baseName =
      selectedEmployeeObj.name ||
      `${selectedEmployeeObj.firstName || ""} ${selectedEmployeeObj.lastName || ""}`.trim() ||
      "Unnamed Employee";

    const designation = selectedEmployeeObj.designation || selectedEmployeeObj.jobTitle || "No Designation";

    const isInactive =
      selectedEmployeeObj.status && selectedEmployeeObj.status.toLowerCase() !== "active";

    return isInactive ? `${baseName} - ${designation} (${selectedEmployeeObj.status})` : `${baseName} - ${designation}`;
  };

  const getInputClass = (hasError = false) => {
    const baseClass =
      "w-full px-3.5 py-2.5 bg-surface-card border rounded-xl text-xs text-content-main placeholder-content-muted transition-all duration-200 shadow-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed";
    const normalClass =
      "border-line-subtle hover:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent";
    const errorClass =
      "border-rose-300 bg-rose-50/10 text-rose-900 hover:border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500";

    return `${baseClass} ${hasError ? errorClass : normalClass}`;
  };

  const currencyPrefix = <span className="text-[10px] font-bold">Rs.</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs transition-opacity z-10"
        onClick={onClose}
      />

      <div className="relative bg-surface-card border border-line-subtle rounded-2xl max-w-2xl w-full p-6 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-150">
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-brand-accent to-brand-hover" />

        <div className="flex items-center justify-between pb-4 border-b border-line-subtle">
          <div>
            <h2 className="text-base font-extrabold text-content-main tracking-tight">Generate Payslip</h2>
            <p className="text-[11px] text-content-secondary mt-0.5 font-medium">
              Record and issue a salary statement entry linked to an employee.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-brand-accent hover:bg-brand-subtle transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {validationError && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50/75 border border-rose-100 rounded-xl text-rose-800 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold">Validation Notice</h4>
                <p className="text-[11px] text-rose-600/90 mt-0.5 font-medium">{validationError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 relative" ref={employeeRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Select Employee
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsEmployeeOpen(!isEmployeeOpen);
                  setIsPaymentMethodOpen(false);
                }}
                disabled={isLoading || (employees || []).length === 0}
                className={`${getInputClass(!formData.employeeId && !!validationError)} pl-9 pr-3 flex items-center justify-between text-left cursor-pointer z-40 relative`}
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <span className="truncate pr-4">{getEmployeeDisplayLabel()}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                    isEmployeeOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isEmployeeOpen && (
                <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 max-h-60 overflow-y-auto">
                  {(employees || []).map((emp) => {
                    if (!emp) return null;
                    const empId = emp._id?.toString() || emp.id?.toString() || "";
                    const baseName =
                      emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Unnamed Employee";
                    const designation = emp.designation || emp.jobTitle || "No Designation";
                    const isInactive = emp.status && emp.status.toLowerCase() !== "active";
                    const displayLabel = `${baseName} - ${designation}${isInactive ? ` (${emp.status})` : ""}`;

                    return (
                      <button
                        key={empId}
                        type="button"
                        onClick={() => handleEmployeeSelect(empId)}
                        className={`dropdown-option ${formData.employeeId === empId ? "dropdown-option-active" : ""}`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Job Title / Role
              </label>
              <input
                type="text"
                name="jobTitle"
                disabled
                placeholder="Auto-populated"
                value={formData.jobTitle}
                className="w-full px-3.5 py-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main placeholder-content-muted shadow-sm outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Pay Period
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-content-muted">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="month"
                  required
                  value={periodToMonthInputValue(formData.period)}
                  min={monthInputBounds.min}
                  max={monthInputBounds.max}
                  onChange={handlePeriodChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main placeholder-content-muted transition-all duration-200 shadow-sm outline-none focus:ring-2 focus:ring-brand-accent/25 focus:border-brand-accent cursor-pointer [color-scheme:light]"
                />
              </div>
              <p className="text-[10px] text-content-muted">
                Pick any past month (up to 10 years) for backdated payslips.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 relative" ref={paymentMethodRef}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Payment Method
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsPaymentMethodOpen(!isPaymentMethodOpen);
                  setIsEmployeeOpen(false);
                }}
                className={`${getInputClass()} pl-9 pr-3 flex items-center justify-between text-left cursor-pointer z-40 relative`}
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none">
                  <CreditCard className="w-4 h-4" />
                </span>
                <span>{formData.paymentMethod}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                    isPaymentMethodOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isPaymentMethodOpen && (
                <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {["Bank Transfer", "Hand Cash", "Check"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, paymentMethod: method }));
                        setIsPaymentMethodOpen(false);
                      }}
                      className={`dropdown-option ${formData.paymentMethod === method ? "dropdown-option-active" : ""}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Payment Date
              </label>
              <input
                type="date"
                name="paymentDate"
                required
                value={formData.paymentDate}
                onChange={handleChange}
                className={`${getInputClass()} cursor-pointer`}
              />
            </div>
          </div>

          <div className="p-4 bg-surface-main rounded-2xl border border-line-subtle space-y-3">
            <div className="flex items-center justify-between border-b border-line-subtle pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                Financial Breakdown (Rs.)
              </span>
              {formData.employeeId && formData.period && (
                <button
                  type="button"
                  onClick={handleResetToCalculated}
                  className="text-[10px] font-bold text-brand-accent hover:underline cursor-pointer transition-all"
                >
                  Reset to Calculated
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-content-secondary">Basic Salary</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-content-muted">
                    {currencyPrefix}
                  </span>
                  <input
                    type="number"
                    name="basicSalary"
                    required
                    min={1}
                    value={formData.basicSalary || ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={`pl-7 ${getInputClass(formData.basicSalary <= 0 && !!validationError)}`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-content-secondary">Allowances</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-content-muted">
                    {currencyPrefix}
                  </span>
                  <input
                    type="number"
                    name="allowances"
                    min={0}
                    value={formData.allowances || ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={`pl-7 ${getInputClass()}`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-content-secondary">Bonus</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-content-muted">
                    {currencyPrefix}
                  </span>
                  <input
                    type="number"
                    name="bonus"
                    min={0}
                    value={formData.bonus || ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={`pl-7 ${getInputClass()}`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-content-secondary">Deductions</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-content-muted">
                    {currencyPrefix}
                  </span>
                  <input
                    type="number"
                    name="deductions"
                    min={0}
                    value={formData.deductions || ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={`pl-7 ${getInputClass()}`}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-content-secondary">Income Tax</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-content-muted">
                    {currencyPrefix}
                  </span>
                  <input
                    type="number"
                    name="tax"
                    min={0}
                    value={formData.tax || ""}
                    onChange={handleChange}
                    placeholder="0"
                    className={`pl-7 ${getInputClass()}`}
                  />
                </div>
                <p className="text-[10px] text-content-muted">
                  Shown on the payslip so the employee can see the tax on this salary.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-content-secondary">Tax Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, taxMode: "deduct" }))}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      formData.taxMode === "deduct"
                        ? "bg-rose-50 border-rose-300 text-rose-700"
                        : "bg-surface-card border-line-subtle text-content-secondary"
                    }`}
                  >
                    Deduct from salary
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, taxMode: "add" }))}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      formData.taxMode === "add"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-surface-card border-line-subtle text-content-secondary"
                    }`}
                  >
                    Add to salary
                  </button>
                </div>
                <p className="text-[10px] text-content-muted">
                  {formData.taxMode === "add"
                    ? "This amount is added on top of the salary."
                    : "This amount is taken out of the salary before net pay."}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-line-subtle flex items-center justify-between text-xs">
              <span className="font-semibold text-content-secondary">
                Calculated Net Pay
                {formData.tax > 0
                  ? formData.taxMode === "add"
                    ? " (tax added)"
                    : " (tax deducted)"
                  : ""}
                :
              </span>
              <span className="font-bold text-brand-accent bg-brand-subtle border border-brand-subtle px-2.5 py-1 rounded-lg">
                Rs.
                {netPay.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="flex justify-end items-center gap-2 pt-4 border-t border-line-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-content-secondary bg-surface-main hover:bg-brand-subtle hover:text-brand-accent rounded-xl border border-line-subtle transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 text-xs font-bold text-white bg-brand-accent hover:bg-brand-hover rounded-xl shadow-xs hover:shadow-md transition cursor-pointer"
            >
              Issue Payment Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}