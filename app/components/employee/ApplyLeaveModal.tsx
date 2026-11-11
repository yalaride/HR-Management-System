"use client";

import React, { useMemo, useState } from "react";
import { X, CalendarCheck } from "lucide-react";

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  canRequestLeave?: boolean;
  onSubmit: (formData: {
    type: "FULL" | "HALF";
    startDate: string;
    endDate: string;
    reason: string;
  }) => Promise<void>;
}

function karachiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function isSunday(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

function endForLength(start: string, count: number): string {
  let cursor = start;
  let counted = isSunday(cursor) ? 0 : 1;
  while (counted < count) {
    cursor = addDays(cursor, 1);
    if (!isSunday(cursor)) counted += 1;
  }
  return cursor;
}

export default function ApplyLeaveModal({
  isOpen,
  onClose,
  onSubmit,
  canRequestLeave = true,
}: ApplyLeaveModalProps) {
  const today = useMemo(() => karachiToday(), []);
  const earliest = useMemo(() => addDays(today, 2), [today]);
  const [kind, setKind] = useState<"FULL" | "HALF">("FULL");
  const [startDate, setStartDate] = useState("");
  const [length, setLength] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");

  if (!isOpen || !canRequestLeave) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!startDate || !reason.trim()) {
      setValidationError("Choose the date and write a reason.");
      return;
    }
    if (isSunday(startDate)) {
      setValidationError("Sunday is not a working day.");
      return;
    }
    if (startDate < earliest) {
      setValidationError(`The earliest date you can request today is ${earliest}. A date sooner than that is set by Admin.`);
      return;
    }
    const end = kind === "HALF" ? startDate : endForLength(startDate, length);
    try {
      setLoading(true);
      setValidationError("");
      await onSubmit({ type: kind, startDate, endDate: end, reason: reason.trim() });
      setKind("FULL");
      setStartDate("");
      setLength(1);
      setReason("");
      onClose();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Failed to submit the request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-content-main/40" onClick={onClose} aria-label="Close" />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-2xl border border-line-subtle bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-brand-accent" />
              <h2 className="text-base font-extrabold text-content-main">Apply for leave</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-content-muted hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {validationError && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {validationError}
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
            Type
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as "FULL" | "HALF")}
              className="mt-1 w-full rounded-xl border border-line-subtle px-3 py-2.5 text-xs font-semibold"
            >
              <option value="FULL">Full day</option>
              <option value="HALF">Half day</option>
            </select>
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
            Date
            <input
              type="date"
              required
              min={earliest}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line-subtle px-3 py-2.5 text-xs"
            />
          </label>
          {kind === "FULL" && (
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setLength(count)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                    length === count
                      ? "border-brand-accent bg-brand-subtle text-brand-accent"
                      : "border-line-subtle text-content-secondary"
                  }`}
                >
                  {count} day{count === 2 ? "s" : ""}
                </button>
              ))}
            </div>
          )}
          <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
            Reason
            <textarea
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-line-subtle px-3 py-2.5 text-xs"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-content-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="rounded-xl bg-brand-accent px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            {loading ? "Submitting..." : "Submit request"}
          </button>
        </div>
      </form>
    </div>
  );
}
