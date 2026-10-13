"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, ChevronDown, AlertTriangle, CalendarCheck, Clock } from "lucide-react";

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  canRequestLeave?: boolean;
  onSubmit: (formData: {
    type: "ANNUAL" | "SICK" | "CASUAL";
    startDate: string;
    endDate: string;
    reason: string;
  }) => Promise<void>;
}

const LEAVE_TYPES = [
  { value: "ANNUAL" as const, label: "Annual Leave" },
  { value: "SICK" as const, label: "Sick Leave" },
  { value: "CASUAL" as const, label: "Casual Leave" },
];

// Number of days in advance required for Annual & Casual leaves
const ADVANCE_NOTICE_DAYS = 2;

export default function ApplyLeaveModal({
  isOpen,
  onClose,
  onSubmit,
  canRequestLeave = true,
}: ApplyLeaveModalProps) {
  const [form, setForm] = useState({
    type: "ANNUAL" as "ANNUAL" | "SICK" | "CASUAL",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [isTypeOpen, setIsTypeOpen] = useState(false);

  const typeRef = useRef<HTMLDivElement>(null);

  // Compute today's date in Karachi timezone (YYYY-MM-DD)
  const todayString = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  // Compute minimum date for Annual / Casual leaves (Today + 2 days)
  const minPlannedDateString = useMemo(() => {
    const [year, month, day] = todayString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + ADVANCE_NOTICE_DAYS);
    return date.toISOString().split("T")[0];
  }, [todayString]);

  // Formatted display date for policy info (e.g., "Oct 11, 2026")
  const formattedMinPlannedDate = useMemo(() => {
    return new Date(`${minPlannedDateString}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [minPlannedDateString]);

  const isSickLeave = form.type === "SICK";

  // Reset or initialize state when opening modal
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setForm({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
      setValidationError("");
      setIsTypeOpen(false);
    }
  }

  // Click-outside listener for the leave type dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(event.target as Node)) {
        setIsTypeOpen(false);
      }
    }
    if (isTypeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTypeOpen]);

  if (!isOpen || !canRequestLeave) return null;

  // Handles type change and automatically updates dates if switching types
  const handleTypeChange = (newType: "ANNUAL" | "SICK" | "CASUAL") => {
    setIsTypeOpen(false);
    setValidationError("");

    setForm((prev) => {
      let updatedStart = prev.startDate;
      let updatedEnd = prev.endDate;

      if (newType !== "SICK" && updatedStart && updatedStart < minPlannedDateString) {
        updatedStart = minPlannedDateString;
        if (updatedEnd && updatedEnd < minPlannedDateString) {
          updatedEnd = minPlannedDateString;
        }
      }

      return {
        ...prev,
        type: newType,
        startDate: updatedStart,
        endDate: updatedEnd,
      };
    });
  };

  const handleStartDateChange = (val: string) => {
    setForm((prev) => {
      const next = { ...prev, startDate: val };
      if (prev.endDate && prev.endDate < val) {
        next.endDate = val;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      setValidationError("Please fill out all required fields.");
      return;
    }

    if (form.startDate < todayString) {
      setValidationError("Leave start date cannot be in the past.");
      return;
    }

    if (form.startDate > form.endDate) {
      setValidationError("Start date cannot occur after the end date.");
      return;
    }

    // 2-day advance check for Annual and Casual leaves
    if (!isSickLeave && form.startDate < minPlannedDateString) {
      setValidationError(
        `${form.type === "ANNUAL" ? "Annual" : "Casual"} leave must be applied at least ${ADVANCE_NOTICE_DAYS} days in advance (Earliest allowed: ${formattedMinPlannedDate}).`
      );
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      });
      setForm({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to submit request.";
      setValidationError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getInputClass = (hasError = false) => {
    const base =
      "w-full px-3.5 py-2.5 bg-surface-card border rounded-xl text-xs text-content-main placeholder-content-muted transition-all duration-200 shadow-xs outline-none disabled:opacity-50 disabled:cursor-not-allowed";
    const normal =
      "border-line-subtle hover:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent";
    const error =
      "border-rose-300 bg-rose-50/10 text-rose-900 hover:border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500";
    return `${base} ${hasError ? error : normal}`;
  };

  const selectedTypeLabel = LEAVE_TYPES.find((t) => t.value === form.type)?.label || "Annual Leave";

  // Earliest start date allowed: Today for Sick, 2 days in advance for Annual/Casual
  const minStartDate = isSickLeave ? todayString : minPlannedDateString;
  const minEndDate = form.startDate || minStartDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-surface-card border border-line-subtle rounded-2xl max-w-md w-full p-6 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-150">
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-brand-accent to-brand-hover" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line-subtle">
          <div>
            <h2 className="text-base font-extrabold text-content-main tracking-tight">Request Leave</h2>
            <p className="text-[11px] text-content-secondary mt-0.5 font-medium">
              Specify your leave type and dates.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-brand-accent hover:bg-brand-subtle transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {validationError && (
            <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-[11px] font-medium leading-relaxed">{validationError}</div>
            </div>
          )}

          {/* Leave Type Dropdown */}
          <div className="space-y-1.5 relative" ref={typeRef}>
            <label className="field-label block">Select Leave Type</label>
            <button
              type="button"
              onClick={() => setIsTypeOpen(!isTypeOpen)}
              className={`${getInputClass()} flex items-center justify-between text-left cursor-pointer z-20 relative`}
            >
              <span className="font-semibold">{selectedTypeLabel}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${
                  isTypeOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isTypeOpen && (
              <div className="dropdown-panel absolute left-0 right-0 mt-1.5 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                {LEAVE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleTypeChange(type.value)}
                    className={`dropdown-option ${
                      form.type === type.value ? "dropdown-option-active" : ""
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Context Policy Notice */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-colors duration-200 ${
              isSickLeave
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                : "bg-amber-50/80 border-amber-200 text-amber-900"
            }`}
          >
            {isSickLeave ? (
              <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <CalendarCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="text-[11px] leading-relaxed">
              {isSickLeave ? (
                <span>
                  <strong className="font-bold">Immediate Request:</strong> Sick leave can be requested starting today without 2-day advance notice.
                </span>
              ) : (
                <span>
                  <strong className="font-bold">2-Day Advance Notice Required:</strong> {selectedTypeLabel} must be requested at least {ADVANCE_NOTICE_DAYS} days in advance. Earliest start date is{" "}
                  <span className="font-bold underline">{formattedMinPlannedDate}</span>.
                </span>
              )}
            </div>
          </div>

          {/* Date Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="field-label block">Start Date</label>
              <input
                type="date"
                required
                value={form.startDate}
                min={minStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={`${getInputClass(
                  !!validationError &&
                    (!form.startDate || (!isSickLeave && form.startDate < minPlannedDateString))
                )} cursor-pointer`}
              />
              <span className="text-[10px] text-content-muted block pl-0.5">
                {isSickLeave ? `Today (${todayString}) onwards` : `Min: ${minPlannedDateString}`}
              </span>
            </div>

            <div className="space-y-1">
              <label className="field-label block">End Date</label>
              <input
                type="date"
                required
                value={form.endDate}
                min={minEndDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={`${getInputClass(
                  !!validationError &&
                    (!form.endDate || (!!form.startDate && form.endDate < form.startDate))
                )} cursor-pointer`}
              />
              <span className="text-[10px] text-content-muted block pl-0.5">
                {form.startDate ? `On or after ${form.startDate}` : "Select start date first"}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="field-label block">Leave Reason Details</label>
            <textarea
              rows={3}
              required
              placeholder="State the reason for taking leave..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className={`${getInputClass(!!validationError && !form.reason.trim())} resize-none leading-relaxed`}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-2 pt-4 border-t border-line-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4.5 py-2.5 text-xs font-bold text-content-secondary bg-surface-main hover:bg-brand-subtle hover:text-brand-accent rounded-xl border border-line-subtle transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4.5 py-2.5 text-xs font-bold text-white bg-brand-accent hover:bg-brand-hover rounded-xl shadow-xs transition duration-150 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Dispatching..." : "Dispatch Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}