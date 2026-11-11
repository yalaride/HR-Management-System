"use client";

import React, { useState } from "react";
import useSWR from "swr";

interface GrantEmployee {
  userId: string;
  name: string;
  designation: string;
  department: string;
}

export default function GrantLeaveForm() {
  const { data } = useSWR<{ employees?: GrantEmployee[] }>("/api/admin/leaves/grant");
  const [userId, setUserId] = useState("");
  const [kind, setKind] = useState<"URGENT" | "EXTRA_PAID">("URGENT");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const employees = data?.employees || [];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/leaves/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, kind, startDate, endDate, reason }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; days?: number };
      if (!res.ok) throw new Error(body.error || "Could not set the leave.");
      setMessage(`Saved ${body.days} paid day${body.days === 1 ? "" : "s"}.`);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the leave.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 rounded-2xl border border-line-subtle bg-white p-5">
      <div>
        <h1 className="text-xl font-extrabold text-content-main">Set leave</h1>
        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
          Urgent leave uses that month’s 2 full days and can be set without the 2-day notice. Extra paid leave is outside the monthly allowance, for example 7 paid days.
        </p>
      </div>
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
      {message && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</div>}
      <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
        Employee
        <select required value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1 w-full rounded-xl border border-line-subtle px-3 py-2.5 text-xs">
          <option value="">Select</option>
          {employees.map((employee) => (
            <option key={employee.userId} value={employee.userId}>
              {employee.name} {employee.designation ? `(${employee.designation})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
        Kind
        <select value={kind} onChange={(event) => setKind(event.target.value as "URGENT" | "EXTRA_PAID")} className="mt-1 w-full rounded-xl border border-line-subtle px-3 py-2.5 text-xs">
          <option value="URGENT">Urgent leave</option>
          <option value="EXTRA_PAID">Extra paid leave</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
          Start
          <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-xl border border-line-subtle px-3 py-2.5 text-xs" />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
          End
          <input required type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-xl border border-line-subtle px-3 py-2.5 text-xs" />
        </label>
      </div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
        Reason
        <textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-line-subtle px-3 py-2.5 text-xs" />
      </label>
      <button type="submit" disabled={saving} className="rounded-xl bg-brand-accent px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
        {saving ? "Saving..." : "Set paid leave"}
      </button>
    </form>
  );
}
