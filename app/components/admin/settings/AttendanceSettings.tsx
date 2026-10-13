"use client";

import React, { useState } from "react";
import { Clock, Edit2, X, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

interface AttendanceData {
  shiftStart: string;
  shiftEnd: string;
  gracePeriod: number;
  checkInDisplayBefore: number;
  checkOutDisplayAfter: number;
  autoCheckOut: boolean;
}

interface AttendanceSettingsProps {
  data: AttendanceData;
  onSave: (updatedData: Partial<AttendanceData>) => Promise<void>;
  readOnly?: boolean;
}

/** Converts "HH:MM" 24-hour time string to 12-hour AM/PM format */
function formatTo12Hour(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export default function AttendanceSettings({ data, onSave, readOnly = false }: AttendanceSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempData, setTempData] = useState<AttendanceData>({ ...data });

  // Raw string values for number inputs to preserve leading zeros during editing
  const [rawStringValues, setRawStringValues] = useState<Record<string, string>>({
    gracePeriod: String(data.gracePeriod),
  });

  // Sync local editing state from props when data prop changes
  const [prevData, setPrevData] = useState<AttendanceData | null>(null);
  if (data !== prevData) {
    setPrevData(data);
    setTempData({ ...data });
    setRawStringValues({
      gracePeriod: String(data.gracePeriod),
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    try {
      setSaving(true);
      await onSave(tempData);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Attendance parameters container */}
      <div className="panel bg-white border border-line-subtle rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-line-subtle">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-accent" />
            <h3 className="text-sm font-bold text-content-main">Attendance Rules</h3>
          </div>

          {!isEditing ? (
            readOnly ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-line-subtle text-content-secondary text-xs font-bold rounded-lg">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                <span>Rules are read-only</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-subtle hover:bg-brand-accent hover:text-white text-brand-accent text-xs font-bold rounded-lg transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Rules</span>
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-main hover:bg-line-subtle text-content-secondary text-xs font-bold rounded-lg transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || readOnly}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-4">
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-content-secondary">Shift Start Time</label>
                <input
                  type="time"
                  required
                  value={tempData.shiftStart}
                  onChange={(e) => setTempData({ ...tempData, shiftStart: e.target.value })}
                  disabled={saving || readOnly}
                  className="form-input text-xs w-full p-2 border border-line-subtle rounded-lg outline-none disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-content-secondary">Shift End Time</label>
                <input
                  type="time"
                  required
                  value={tempData.shiftEnd}
                  onChange={(e) => setTempData({ ...tempData, shiftEnd: e.target.value })}
                  disabled={saving || readOnly}
                  className="form-input text-xs w-full p-2 border border-line-subtle rounded-lg outline-none disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-content-secondary">Allowed Grace Period (Mins)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={rawStringValues.gracePeriod}
                  onChange={(e) => {
                    setRawStringValues({ ...rawStringValues, gracePeriod: e.target.value });
                    setTempData({ ...tempData, gracePeriod: Number(e.target.value) || 0 });
                  }}
                  disabled={saving || readOnly}
                  className="form-input text-xs w-full p-2 border border-line-subtle rounded-lg outline-none disabled:opacity-50"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 py-2">
              <div>
                <span className="text-xs font-semibold text-content-secondary">Shift Window</span>
                <span className="text-sm font-semibold text-content-main block mt-0.5">
                  {formatTo12Hour(data.shiftStart)} to {formatTo12Hour(data.shiftEnd)}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-content-secondary">Grace Period</span>
                <span className="text-sm font-semibold text-content-main block mt-0.5">
                  {data.gracePeriod} minutes
                </span>
              </div>
              <div className="md:col-span-2 border-t border-line-subtle pt-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-brand-accent" />
                <span className="text-xs font-semibold text-content-secondary">
                  Check-in and check-out are recorded on the office fingerprint device.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}