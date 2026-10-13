"use client";

import React, { useState } from "react";
import { Clock, Edit2, X, CheckCircle2, Loader2, Eye, ShieldAlert } from "lucide-react";

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
    checkInDisplayBefore: String(data.checkInDisplayBefore),
    checkOutDisplayAfter: String(data.checkOutDisplayAfter),
  });

  // Simulator Time state is purely local client-side state (never sent to backend)
  const [simulatedTime, setSimulatedTime] = useState(data.shiftStart || "08:45");

  // Sync local editing state from props when data prop changes
  const [prevData, setPrevData] = useState<AttendanceData | null>(null);
  if (data !== prevData) {
    setPrevData(data);
    setTempData({ ...data });
    setRawStringValues({
      gracePeriod: String(data.gracePeriod),
      checkInDisplayBefore: String(data.checkInDisplayBefore),
      checkOutDisplayAfter: String(data.checkOutDisplayAfter),
    });
    setSimulatedTime(data.shiftStart);
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

  // Visibility logic calculations based on active values
  const checkButtonsVisibility = (timeStr: string) => {
    const [simH, simM] = timeStr.split(":").map(Number);
    const [startH, startM] = data.shiftStart.split(":").map(Number);
    const [endH, endM] = data.shiftEnd.split(":").map(Number);

    const simMin = simH * 60 + simM;
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    const checkInOffset = data.checkInDisplayBefore || 30;
    const canCheckIn = simMin >= (startMin - checkInOffset) && simMin < endMin;

    const checkOutOffset = data.checkOutDisplayAfter || 0;
    const canCheckOut = simMin >= (endMin + checkOutOffset);

    return { canCheckIn, canCheckOut };
  };

  const { canCheckIn, canCheckOut } = checkButtonsVisibility(simulatedTime);

  const getReadableTime = (timeStr: string, minutesOffset: number) => {
    const [h, m] = timeStr.split(":").map(Number);
    let total = h * 60 + m + minutesOffset;
    if (total < 0) total += 24 * 60;
    total = total % (24 * 60);
    const finalH = Math.floor(total / 60);
    const finalM = total % 60;
    const raw = `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
    return formatTo12Hour(raw);
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

              {/* Persistable Visibility offsets */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-content-secondary">
                  Show Check-In Button (Minutes Before Shift)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={rawStringValues.checkInDisplayBefore}
                  onChange={(e) => {
                    setRawStringValues({ ...rawStringValues, checkInDisplayBefore: e.target.value });
                    setTempData({ ...tempData, checkInDisplayBefore: Number(e.target.value) || 0 });
                  }}
                  className="form-input text-xs w-full p-2 border border-line-subtle rounded-lg outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-content-secondary">
                  Show Check-Out Button (Minutes After Shift End)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={rawStringValues.checkOutDisplayAfter}
                  onChange={(e) => {
                    setRawStringValues({ ...rawStringValues, checkOutDisplayAfter: e.target.value });
                    setTempData({ ...tempData, checkOutDisplayAfter: Number(e.target.value) || 0 });
                  }}
                  className="form-input text-xs w-full p-2 border border-line-subtle rounded-lg outline-none"
                />
              </div>

              {/* Automatic check-out settings */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-line-subtle pt-4 mt-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoCheckOut"
                    checked={tempData.autoCheckOut}
                    onChange={(e) => setTempData({ ...tempData, autoCheckOut: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-accent border-line-subtle cursor-pointer"
                  />
                  <label htmlFor="autoCheckOut" className="text-xs font-bold text-content-main cursor-pointer">
                    Enable Auto Check-Out
                  </label>
                </div>

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
              <div>
                <span className="text-xs font-semibold text-content-secondary">Check-In Active Display Window</span>
                <span className="text-sm font-semibold text-content-main block mt-0.5">
                  Appears {data.checkInDisplayBefore} mins before Shift Start
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-content-secondary">Check-Out Active Display Window</span>
                <span className="text-sm font-semibold text-content-main block mt-0.5">
                  Appears {data.checkOutDisplayAfter} mins after Shift End
                </span>
              </div>
              <div className="md:col-span-2 border-t border-line-subtle pt-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-brand-accent" />
                <span className="text-xs font-semibold text-content-secondary">
                  Auto Check-Out is <strong className="text-content-main">{data.autoCheckOut ? "Enabled" : "Disabled"}</strong>
                  {data.autoCheckOut && " (runs daily at 08:00 PM Asia/Karachi)"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulator (Purely Client-Side UI tool) */}
      <div className="panel bg-surface-subtle border border-line-subtle rounded-2xl p-6">
        <div className="flex items-center gap-2 pb-4 border-b border-line-subtle">
          <Eye className="w-5 h-5 text-brand-accent" />
          <h4 className="text-sm font-bold text-content-main">Employee View Simulator (Local State)</h4>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-3 bg-white p-4 border border-line-subtle rounded-xl">
            <div className="space-y-1">
              <label className="text-xs font-bold text-content-secondary">Simulate Clock Time</label>
              <input
                type="time"
                value={simulatedTime}
                onChange={(e) => setSimulatedTime(e.target.value)}
                className="form-input text-xs w-full p-2 border border-line-subtle rounded-lg outline-none"
              />
            </div>
            
            <div className="text-xs space-y-1 text-content-secondary border-t border-line-subtle pt-2.5">
              <div className="flex justify-between">
                <span>Check-in active starting at:</span>
                <span className="font-bold text-emerald-600">
                  {getReadableTime(data.shiftStart, -(data.checkInDisplayBefore || 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Check-out active starting at:</span>
                <span className="font-bold text-amber-600">
                  {getReadableTime(data.shiftEnd, (data.checkOutDisplayAfter || 0))}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-white border border-line-subtle rounded-xl min-h-[140px] gap-3">
            <span className="text-xs font-bold text-content-secondary tracking-wide uppercase">
              Employee Portal Preview ({formatTo12Hour(simulatedTime)})
            </span>
            
            <div className="flex items-center gap-4 w-full justify-center">
              {canCheckIn ? (
                <button
                  type="button"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md cursor-default transition"
                >
                  Check In
                </button>
              ) : (
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl italic">
                  Check-In Hidden
                </span>
              )}

              {canCheckOut ? (
                <button
                  type="button"
                  className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md cursor-default transition"
                >
                  Check Out
                </button>
              ) : (
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl italic">
                  Check-Out Hidden
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}