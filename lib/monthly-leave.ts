/** Fixed monthly leave policy. This is not editable in the admin panel. */

export const MONTHLY_FULL_DAYS = 2;
export const MONTHLY_HALF_DAYS = 1;
export const ADVANCE_NOTICE_DAYS = 2;

export function karachiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function isSundayIso(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

export function eachIsoDate(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return dates;
}

/** Monday–Saturday. Sunday is not a leave day and does not use the monthly allowance. */
export function workingDates(start: string, end: string): string[] {
  return eachIsoDate(start, end).filter((date) => !isSundayIso(date));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export interface QuotaLeave {
  type: string;
  status: string;
  startDate: string;
  endDate: string;
}

export function monthUsage(leaves: QuotaLeave[], month: string): { full: number; half: number } {
  let full = 0;
  let half = 0;
  for (const leave of leaves) {
    const status = leave.status.toUpperCase();
    if (status !== "PENDING" && status !== "APPROVED") continue;
    const type = leave.type.toUpperCase();
    const days = workingDates(leave.startDate, leave.endDate).filter((date) => date.startsWith(month));
    if (!days.length) continue;
    if (type === "HALF") half += 1;
    else if (type === "FULL" || type === "URGENT") full += days.length;
  }
  return { full, half };
}

export function earliestEmployeeStart(today: string): string {
  return addIsoDays(today, ADVANCE_NOTICE_DAYS);
}

export function workingEndDate(start: string, workingDayCount: number): string {
  let cursor = start;
  let counted = isSundayIso(cursor) ? 0 : 1;
  while (counted < workingDayCount) {
    cursor = addIsoDays(cursor, 1);
    if (!isSundayIso(cursor)) counted += 1;
  }
  return cursor;
}

function groupedWorkingDays(start: string, end: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const date of workingDates(start, end)) {
    const month = monthKey(date);
    groups.set(month, [...(groups.get(month) || []), date]);
  }
  return groups;
}

export function validateEmployeeLeave(input: {
  kind: "FULL" | "HALF";
  start: string;
  end: string;
  today: string;
  existing: QuotaLeave[];
}): { ok: true; days: number } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start) || !/^\d{4}-\d{2}-\d{2}$/.test(input.end)) {
    return { ok: false, error: "Choose a valid date range." };
  }
  if (input.end < input.start) {
    return { ok: false, error: "The end date cannot be before the start date." };
  }
  const earliest = earliestEmployeeStart(input.today);
  if (input.start < earliest) {
    return {
      ok: false,
      error: `Leave must be applied at least ${ADVANCE_NOTICE_DAYS} days before it starts. The earliest date you can request today is ${earliest}. A nearer date has to be set by Admin.`,
    };
  }

  const days = workingDates(input.start, input.end);
  if (!days.length) {
    return { ok: false, error: "Sunday is not a working day, so it cannot be requested as leave." };
  }
  if (input.kind === "HALF") {
    if (input.start !== input.end || days.length !== 1) {
      return { ok: false, error: "A half day is one working day only. A month includes one half day, not several." };
    }
  } else if (days.length !== 1 && days.length !== 2) {
    return { ok: false, error: "A full-day request is 1 day or 2 days. A month includes 2 full days in total." };
  }

  for (const [month, monthDays] of groupedWorkingDays(input.start, input.end)) {
    const used = monthUsage(input.existing, month);
    if (input.kind === "HALF") {
      if (used.half >= MONTHLY_HALF_DAYS) {
        return { ok: false, error: `${month} already has its half day. It does not carry into another month.` };
      }
    } else if (used.full + monthDays.length > MONTHLY_FULL_DAYS) {
      const left = Math.max(0, MONTHLY_FULL_DAYS - used.full);
      return {
        ok: false,
        error: `${month} has ${left} full day${left === 1 ? "" : "s"} left. This request needs ${monthDays.length}. Unused days do not move to the next month.`,
      };
    }
  }

  return { ok: true, days: input.kind === "HALF" ? 0.5 : days.length };
}

export function validateGrantedLeave(input: {
  kind: "URGENT" | "EXTRA_PAID";
  start: string;
  end: string;
  today: string;
  existing: QuotaLeave[];
}): { ok: true; days: number } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start) || !/^\d{4}-\d{2}-\d{2}$/.test(input.end)) {
    return { ok: false, error: "Choose a valid date range." };
  }
  if (input.end < input.start) {
    return { ok: false, error: "The end date cannot be before the start date." };
  }
  const currentMonthStart = `${monthKey(input.today)}-01`;
  if (input.start < currentMonthStart) {
    return { ok: false, error: "A leave cannot be added for a month that has already ended." };
  }
  const days = workingDates(input.start, input.end);
  if (!days.length) {
    return { ok: false, error: "Sunday is not a working day, so it cannot be set as leave." };
  }
  if (input.kind === "EXTRA_PAID") {
    return { ok: true, days: days.length };
  }
  for (const [month, monthDays] of groupedWorkingDays(input.start, input.end)) {
    const used = monthUsage(input.existing, month);
    if (used.full + monthDays.length > MONTHLY_FULL_DAYS) {
      const left = Math.max(0, MONTHLY_FULL_DAYS - used.full);
      return {
        ok: false,
        error: `${month} has ${left} full day${left === 1 ? "" : "s"} left in the monthly allowance. Use extra paid leave for days beyond that.`,
      };
    }
  }
  return { ok: true, days: days.length };
}
