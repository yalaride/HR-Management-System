"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { CalendarOff, Trash2 } from "lucide-react";
import {
  buildHolidayAnnouncement,
  formatHolidayDate,
  holidaySubject,
  isIsoDate,
} from "@/lib/holiday-announcement";

interface HolidayRecord {
  _id: string;
  title: string;
  startDate: string;
  endDate: string;
  resumeDate: string;
  subject: string;
  announcement: string;
  sentCount: number;
  failedCount: number;
}

export default function HolidaysPage() {
  const { data, mutate, isLoading } = useSWR<{ holidays: HolidayRecord[] }>("/api/admin/holidays");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draft = useMemo(() => {
    if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) return "";
    return buildHolidayAnnouncement({ title, startDate, endDate });
  }, [title, startDate, endDate]);

  const shownAnnouncement = edited ? announcement : draft;

  const saveHoliday = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startDate,
          endDate,
          subject: holidaySubject(title),
          announcement: shownAnnouncement,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save the holiday");
      setMessage(body.message);
      setTitle("");
      setStartDate("");
      setEndDate("");
      setAnnouncement("");
      setEdited(false);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the holiday");
    } finally {
      setSaving(false);
    }
  };

  const removeHoliday = async (id: string) => {
    const res = await fetch(`/api/admin/holidays/${id}`, { method: "DELETE" });
    if (res.ok) await mutate();
  };

  return (
    <div className="min-h-screen bg-surface-main pb-16">
      <div className="px-2 py-6 space-y-6 w-full">
        <div className="border-b border-line-subtle pb-6">
          <div className="flex items-center gap-2 text-brand-accent">
            <CalendarOff className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Office holidays</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-content-main">Holidays</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Set one day or a date range. Employees see the upcoming holiday and receive the announcement email.
          </p>
        </div>

        <form
          className="panel space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void saveHoliday();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5 sm:col-span-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">Holiday name</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Iqbal Day"
                className="w-full rounded-xl border border-line-subtle px-3 py-2.5 text-sm"
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (!endDate || endDate < event.target.value) setEndDate(event.target.value);
                }}
                className="w-full rounded-xl border border-line-subtle px-3 py-2.5 text-sm"
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">To</span>
              <input
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-xl border border-line-subtle px-3 py-2.5 text-sm"
                required
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
              Announcement email
            </span>
            <textarea
              value={shownAnnouncement}
              onChange={(event) => {
                setEdited(true);
                setAnnouncement(event.target.value);
              }}
              rows={14}
              placeholder="Choose the holiday dates to prepare the announcement."
              className="w-full rounded-xl border border-line-subtle px-3 py-3 text-sm leading-6"
              required
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setEdited(false);
                setAnnouncement("");
              }}
              className="text-xs font-bold text-content-secondary"
            >
              Reset announcement
            </button>
            <button
              type="submit"
              disabled={saving || !shownAnnouncement}
              className="rounded-xl bg-brand-accent px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? "Sending..." : "Save and email everyone"}
            </button>
          </div>
          {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        </form>

        <div className="panel divide-y divide-line-subtle">
          {isLoading ? (
            <p className="p-6 text-sm text-content-secondary">Loading holidays...</p>
          ) : (data?.holidays || []).length === 0 ? (
            <p className="p-6 text-sm text-content-secondary">No holidays have been announced yet.</p>
          ) : (
            data?.holidays.map((holiday) => (
              <div key={holiday._id} className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="font-bold text-content-main">{holiday.title}</p>
                  <p className="mt-1 text-xs text-content-secondary">
                    {holiday.startDate === holiday.endDate
                      ? formatHolidayDate(holiday.startDate)
                      : `${formatHolidayDate(holiday.startDate)} to ${formatHolidayDate(holiday.endDate)}`}
                  </p>
                  <p className="mt-1 text-[11px] text-content-muted">
                    Email sent to {holiday.sentCount}
                    {holiday.failedCount > 0 ? `, ${holiday.failedCount} not delivered` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeHoliday(holiday._id)}
                  className="rounded-lg p-2 text-rose-600"
                  aria-label={`Delete ${holiday.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
