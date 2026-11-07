"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Lock, Info, Calendar, ChevronDown } from "lucide-react";

interface EditAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  date: string;
  initialData: {
    checkIn: string;
    checkOut: string;
    hasCheckOut: boolean;
    enableCheckOut: boolean;
    status: "On Time" | "Late" | "Absent";
    isLocked: boolean;
  };
  onSave: (payload: { userId: string; date: string; checkIn: string | null; checkOut: string | null; status: "On Time" | "Late" | "Absent" }) => Promise<void>;
  shiftStart?: string;
  gracePeriod?: number;
}

export default function EditAttendanceModal({
  isOpen,
  onClose,
  userId,
  date,
  initialData,
  onSave,
  shiftStart = "09:00",
  gracePeriod = 15,
}: EditAttendanceModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form parameters
  const [checkInTime, setCheckInTime] = useState(initialData.checkIn);
  const [checkOutTime, setCheckOutTime] = useState(initialData.checkOut);
  const [enableCheckOut, setEnableCheckOut] = useState(initialData.enableCheckOut);
  const [status, setStatus] = useState<"On Time" | "Late" | "Absent">(initialData.status);

  const minutesOf = (value: string) => {
    const [hours, minutes] = value.split(":").map((part) => Number(part) || 0);
    return hours * 60 + minutes;
  };

  const applyCheckInTime = (value: string) => {
    setCheckInTime(value);
    if (status === "Absent") return;
    const lateAfter = minutesOf(shiftStart) + gracePeriod;
    setStatus(minutesOf(value) > lateAfter ? "Late" : "On Time");
  };

  // Status Select visibility controls
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
    }
    if (isStatusOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isStatusOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData.isLocked) {
      setFormError("Finalization constraint: locked timesheet parameters.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const isAbsent = status === "Absent";

      await onSave({
        userId,
        date,
        checkIn: isAbsent ? null : `${date}T${checkInTime}:00+05:00`,
        checkOut: (isAbsent || !enableCheckOut) ? null : `${date}T${checkOutTime}:00+05:00`,
        status,
      });
    } catch (err) {
      setFormError((err as Error | undefined)?.message || "Failed updating timesheet record.");
    } finally {
      setSubmitting(false);
    }
  };

  const elementStyle = "w-full px-3.5 py-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main placeholder-content-muted transition-all duration-200 shadow-sm outline-none hover:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent flex items-center justify-between text-left cursor-pointer relative font-semibold h-[38px] [color-scheme:light]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="bg-white border border-line-subtle rounded-2xl w-full max-w-md shadow-xl overflow-hidden text-content-main">
        <div className="px-6 py-4 border-b border-line-subtle flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-content-main">
            {initialData.isLocked && <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
            <Calendar className="w-4 h-4 text-brand-accent" />
            <span>Timesheet Adjustments {initialData.isLocked && "(Locked)"}</span>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold">
              {formError}
            </div>
          )}

          {initialData.isLocked ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-[11px] font-semibold animate-in fade-in duration-100">
              <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>This record month is locked. Modifications are restricted.</span>
            </div>
          ) : (
            <>
              {/* 1. Custom Status Dropdown */}
              <div className="relative" ref={statusRef}>
                <label className="block text-[10px] font-bold uppercase mb-1.5 text-content-muted">Arrival Status</label>
                <button
                  type="button"
                  onClick={() => setIsStatusOpen(!isStatusOpen)}
                  className={elementStyle}
                >
                  <span>{status}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${isStatusOpen ? "rotate-180" : ""}`} />
                </button>

                {isStatusOpen && (
                  <div className="dropdown-panel absolute left-0 right-0 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 z-50 bg-white border rounded-xl shadow-lg">
                    {(["On Time", "Late", "Absent"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setStatus(opt);
                          setIsStatusOpen(false);
                        }}
                        className={`dropdown-option w-full text-left text-xs px-3.5 py-2 transition hover:bg-slate-50 ${
                          status === opt ? "dropdown-option-active" : ""
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {status !== "Absent" && (
                <div className="space-y-4">
                  {/* 2. Styled Check-In Time Input */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-1.5 text-content-muted">Check-In</label>
                    <input
                      type="time"
                      required
                      value={checkInTime}
                      onChange={(e) => applyCheckInTime(e.target.value)}
                      className={elementStyle}
                    />
                  </div>

                  {/* 3. Styled Check-Out Checkbox & Time Input */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-bold uppercase text-content-muted">Check-Out</label>
                      {!initialData.hasCheckOut && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id="registerCheckout"
                            checked={enableCheckOut}
                            onChange={(e) => setEnableCheckOut(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent cursor-pointer"
                          />
                          <label htmlFor="registerCheckout" className="text-[10px] font-bold text-emerald-600 cursor-pointer select-none">
                            Register Check-Out
                          </label>
                        </div>
                      )}
                    </div>

                    {!initialData.hasCheckOut && !enableCheckOut ? (
                      <div className="flex items-start gap-2 p-2.5 bg-amber-50/70 border border-amber-100 rounded-xl animate-in fade-in duration-100">
                        <Info className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <span className="text-[10px] text-amber-700 leading-normal">
                          Employee is currently <strong>On Duty</strong>. Check-out is locked. Check &quot;Register Check-Out&quot; to manually checkout.
                        </span>
                      </div>
                    ) : (
                      <input
                        type="time"
                        required={enableCheckOut}
                        value={checkOutTime}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        disabled={!enableCheckOut}
                        className={elementStyle}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-content-secondary bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting || initialData.isLocked}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-accent rounded-xl disabled:opacity-50 cursor-pointer animate-in fade-in duration-100"
            >
              {submitting ? "Saving..." : "Save Adjustments"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}