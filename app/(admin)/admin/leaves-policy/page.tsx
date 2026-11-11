"use client";

export default function AdminLeavesPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-12">
      <h1 className="text-2xl font-extrabold text-content-main">Leave policy</h1>
      <div className="space-y-3 rounded-2xl border border-line-subtle bg-white p-6 text-sm leading-relaxed text-content-secondary">
        <p>Every employee receives 2 full days and 1 half day in each calendar month. This allowance is fixed and is not edited here.</p>
        <p>An employee applies at least 2 days before the leave starts. A request for 1 December uses December’s allowance, so it can be submitted in November as long as 29 November has not passed.</p>
        <p>Unused days stay in that month. They are not added to the next month.</p>
        <p>A nearer date, or days beyond the monthly allowance, is set from Set Leave as urgent leave or extra paid leave.</p>
      </div>
    </div>
  );
}
