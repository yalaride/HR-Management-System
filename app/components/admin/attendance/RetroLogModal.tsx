"use client";

import React, { useEffect, useState } from "react";
import { X, Calendar } from "lucide-react";

interface RetroLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  isLocked: boolean;
  editingLogId: string | null; // null means ADD mode, string means EDIT mode
  initialData: {
    date: string;
    checkIn: string;
    checkOut: string;
    status: "On Time" | "Late" | "Absent";
  };
  onSave: (payload: { userId: string; date: string; checkIn: string | null; checkOut: string | null; status: "On Time" | "Late" | "Absent" }) => Promise<void>;
}

export default function RetroLogModal({
  isOpen,
  onClose,
  userId,
  isLocked,
  editingLogId,
  initialData,
  onSave,
}: RetroLogModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: initialData.date,
    checkIn: initialData.checkIn,
    checkOut: initialData.checkOut,
    status: initialData.status,
  });

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      date: initialData.date,
      checkIn: initialData.checkIn,
      checkOut: initialData.checkOut,
      status: initialData.status,
    });
    setFormError(null);
  }, [isOpen, initialData]);

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setFormError("Finalization restriction: Locked months cannot be modified.");
      return;
    }

    if (form.date > todayStr) {
      setFormError("Validation error: Future attendance logs cannot be entered.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const isAbsent = form.status === "Absent";

      await onSave({
        userId,
        date: form.date,
        checkIn: isAbsent ? null : `${form.date}T${form.checkIn}:00+05:00`,
        checkOut: isAbsent ? null : `${form.date}T${form.checkOut}:00+05:00`,
        status: form.status,
      });
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed saving retro logs.";
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-slate-50 border border-line-subtle rounded-xl text-xs font-semibold outline-none transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent text-content-main placeholder-content-muted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="bg-white border border-line-subtle rounded-2xl w-full max-w-md shadow-xl overflow-hidden text-content-main">
        <div className="px-6 py-4 border-b border-line-subtle flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-content-main">
            <Calendar className="w-4 h-4 text-brand-accent" />
            <span>{editingLogId ? "Edit Historical Day Log" : "Log Retro Work Day Entry"}</span>
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

          <div>
            <label className="block text-[10px] font-bold uppercase mb-1.5 text-content-muted">Target Date</label>
            <input
              type="date"
              required
              disabled={!!editingLogId}
              value={form.date}
              max={todayStr}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase mb-1.5 text-content-muted">Arrival Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as "On Time" | "Late" | "Absent" })}
              className={inputClass}
            >
              <option value="On Time">On Time</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
          </div>

          {form.status !== "Absent" && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1.5 text-content-muted">Check-In</label>
                <input
                  type="time"
                  required
                  value={form.checkIn}
                  onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1.5 text-content-muted">Check-Out</label>
                <input
                  type="time"
                  required
                  value={form.checkOut}
                  onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
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
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-accent rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Saving..." : "Save Log Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}