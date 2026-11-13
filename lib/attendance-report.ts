export const REQUIRED_DAY_MINUTES = 8 * 60;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface AttendanceReportRow {
  date: string;
  weekday: string;
  checkIn: string;
  checkOut: string;
  arrival: string;
  worked: string;
  extra: string;
  short: string;
  paid: string;
  detail: string;
  rawExtraMinutes: number;
  rawShortMinutes: number;
}

export interface AttendanceReportSummary {
  workingDays: number;
  attendedHours: number;
  paidHours: number;
  extraHours: number;
  extraUsedHours: number;
  leaveCoverHours: number;
  shortHours: number;
  totalHours: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  holidayDays: number;
  coverNote: string;
}

export interface AttendanceReport {
  from: string;
  to: string;
  days: AttendanceReportRow[];
  summary: AttendanceReportSummary;
}

export function formatMinutes(total: number): string {
  const safe = Math.max(0, Math.round(total));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours} hrs ${minutes} mins`;
}

const MONTHLY_LEAVE_MINUTES = 20 * 60;

function blankHours(): Pick<AttendanceReportRow, "extra" | "rawExtraMinutes" | "rawShortMinutes"> {
  return { extra: "—", rawExtraMinutes: 0, rawShortMinutes: 0 };
}

function displayShort(minutes: number): string {
  return minutes > 0 ? formatMinutes(minutes) : "—";
}

function hoursFromMinutes(total: number): number {
  return Math.round((total / 60) * 100) / 100;
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function karachiPart(date: Date, type: "hour" | "minute" | "second"): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === type)?.value || 0) % (type === "hour" ? 24 : 60);
}

function clockMinutes(value: string): number {
  const [hour, minute] = value.split(":").map((part) => Number(part) || 0);
  return hour * 60 + minute;
}

/** A punch time that has not happened yet is not a fingerprint. */
export function isFutureFingerprint(instant: Date, now: Date): boolean {
  return Number.isNaN(instant.getTime()) || instant.getTime() > now.getTime() + 2 * 60 * 1000;
}

/**
 * The device sometimes sends the shift start (for example 12:00:00) as its own event.
 * A live tap at that minute is kept. The same time arriving much later is a schedule marker.
 */
export function isShiftStartMarker(instant: Date, now: Date, shiftStart: string): boolean {
  if (Number.isNaN(instant.getTime())) return true;
  const minutes = karachiPart(instant, "hour") * 60 + karachiPart(instant, "minute");
  const seconds = karachiPart(instant, "second");
  return (
    seconds === 0 &&
    minutes === clockMinutes(shiftStart) &&
    Math.abs(now.getTime() - instant.getTime()) > 3 * 60 * 1000
  );
}

function karachiMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === "hour") hours = Number(part.value) % 24;
    if (part.type === "minute") minutes = Number(part.value);
  }
  return hours * 60 + minutes;
}

function clock(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export interface ReportPunch {
  date: string;
  checkIn?: Date | string | null;
  checkOut?: Date | string | null;
  status?: string;
}

export interface ReportLeave {
  type: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface ReportHoliday {
  title: string;
  startDate: string;
  endDate: string;
}

function leaveCovers(leave: ReportLeave, date: string): boolean {
  return leave.status === "APPROVED" && leave.startDate <= date && leave.endDate >= date;
}

function isPaidLeave(type: string): boolean {
  return type.toUpperCase() !== "UNPAID";
}

export function buildAttendanceReport(input: {
  from: string;
  to: string;
  today: string;
  shiftStart: string;
  shiftEnd?: string;
  gracePeriod: number;
  now?: Date;
  punches: ReportPunch[];
  leaves: ReportLeave[];
  holidays: ReportHoliday[];
  omittedDates?: string[];
}): AttendanceReport {
  const omitted = new Set(input.omittedDates || []);
  const punchByDate = new Map(input.punches.map((punch) => [punch.date, punch]));
  const [startHour, startMinute] = input.shiftStart.split(":").map((part) => Number(part) || 0);
  const graceLimit = startHour * 60 + startMinute + input.gracePeriod;

  const days: AttendanceReportRow[] = [];
  let attendedMinutes = 0;
  let paidMinutes = 0;
  let allowanceUsedMinutes = 0;
  let lateDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let holidayDays = 0;

  for (const date of eachDate(input.from, input.to)) {
    if (weekdayIndex(date) === 0 || omitted.has(date)) continue;
    const weekday = WEEKDAYS[weekdayIndex(date)];
    const holiday = input.holidays.find((item) => item.startDate <= date && item.endDate >= date);
    const leave = input.leaves.find((item) => leaveCovers(item, date));
    const punch = punchByDate.get(date);
    if (date.startsWith("2026-10") && !punch?.checkIn && !punch?.checkOut) continue;

    if (holiday) {
      holidayDays += 1;
      paidMinutes += REQUIRED_DAY_MINUTES;
      days.push({
        date,
        weekday,
        checkIn: "—",
        checkOut: "—",
        arrival: "Holiday",
        worked: "—",
        short: "—",
        paid: "8 hrs 0 mins",
        detail: `Company holiday · ${holiday.title}`,
        ...blankHours(),
      });
      continue;
    }

    if (leave && leave.type.toUpperCase() === "HALF") {
      const checkInDate = punch?.checkIn ? new Date(punch.checkIn) : null;
      const checkOutDate = punch?.checkOut ? new Date(punch.checkOut) : null;
      const checkIn = checkInDate && !isFutureFingerprint(checkInDate, input.now ?? new Date()) ? checkInDate : null;
      const checkOut =
        checkOutDate && checkIn && checkOutDate.getTime() > checkIn.getTime() ? checkOutDate : null;
      const worked = checkIn && checkOut
        ? Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000))
        : 0;
      const extra = Math.max(0, worked - REQUIRED_DAY_MINUTES);
      const paid = REQUIRED_DAY_MINUTES / 2;
      const countedWork = Math.min(worked, REQUIRED_DAY_MINUTES - paid);
      const short = Math.max(0, REQUIRED_DAY_MINUTES - countedWork - paid);
      leaveDays += 1;
      allowanceUsedMinutes += paid;
      attendedMinutes += countedWork;
      paidMinutes += paid;
      days.push({
        date,
        weekday,
        checkIn: checkIn ? clock(checkIn) : "—",
        checkOut: checkOut ? clock(checkOut) : "—",
        arrival: "Paid leave",
        worked: worked ? formatMinutes(Math.min(worked, REQUIRED_DAY_MINUTES)) : "—",
        extra: extra ? formatMinutes(extra) : "—",
        short: displayShort(short),
        paid: "4 hrs 0 mins",
        detail: short === 0 ? "Half day leave" : `Half day leave · short ${formatMinutes(short)}`,
        rawExtraMinutes: extra,
        rawShortMinutes: short,
      });
      continue;
    }

    if (leave && isPaidLeave(leave.type)) {
      leaveDays += 1;
      const countsTowardAllowance = leave.type.toUpperCase() !== "EXTRA_PAID";
      if (countsTowardAllowance) allowanceUsedMinutes += REQUIRED_DAY_MINUTES;
      paidMinutes += REQUIRED_DAY_MINUTES;
      days.push({
        date,
        weekday,
        checkIn: "—",
        checkOut: "—",
        arrival: "Paid leave",
        worked: "—",
        short: "—",
        paid: "8 hrs 0 mins",
        detail: "Paid leave · no deduction",
        ...blankHours(),
      });
      continue;
    }

    if (leave && !isPaidLeave(leave.type)) {
      absentDays += 1;
      days.push({
        date,
        weekday,
        checkIn: "—",
        checkOut: "—",
        arrival: "Unpaid leave",
        worked: "0 hrs 0 mins",
        extra: "—",
        short: "8 hrs 0 mins",
        paid: "—",
        detail: "Unpaid leave · 8 hours short",
        rawExtraMinutes: 0,
        rawShortMinutes: REQUIRED_DAY_MINUTES,
      });
      continue;
    }

    const now = input.now ?? new Date();
    const checkInDate = punch?.checkIn ? new Date(punch.checkIn) : null;
    const checkOutDate = punch?.checkOut ? new Date(punch.checkOut) : null;
    const checkIn =
      checkInDate && !isFutureFingerprint(checkInDate, now) ? checkInDate : null;
    const checkOut =
      checkOutDate &&
      checkIn &&
      !isFutureFingerprint(checkOutDate, now) &&
      checkOutDate.getTime() > checkIn.getTime()
        ? checkOutDate
        : null;
    const hasCheckIn = Boolean(checkIn);
    const hasCheckOut = Boolean(checkOut);

    if (hasCheckIn && !hasCheckOut && date === input.today) {
      days.push({
        date,
        weekday,
        checkIn: clock(checkIn),
        checkOut: "—",
        arrival: punch?.status === "Late" ? "Late" : "On Time",
        worked: "In progress",
        extra: "—",
        short: "—",
        paid: "—",
        detail: "Checked in, checkout not recorded yet",
        rawExtraMinutes: 0,
        rawShortMinutes: -1,
      });
      continue;
    }

    if (!hasCheckIn || !hasCheckOut) {
      absentDays += 1;
      days.push({
        date,
        weekday,
        checkIn: hasCheckIn ? clock(checkIn) : "—",
        checkOut: "—",
        arrival: "Absent",
        worked: "0 hrs 0 mins",
        extra: "—",
        short: "8 hrs 0 mins",
        paid: "—",
        detail: hasCheckIn ? "No checkout · 8 hours short" : "Absent · 8 hours short",
        rawExtraMinutes: 0,
        rawShortMinutes: REQUIRED_DAY_MINUTES,
      });
      continue;
    }

    if (!checkIn || !checkOut) continue;

    const worked = Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000));
    const extra = Math.max(0, worked - REQUIRED_DAY_MINUTES);
    const credited = Math.min(REQUIRED_DAY_MINUTES, worked);
    const short = Math.max(0, REQUIRED_DAY_MINUTES - worked);
    const checkInMinutes = karachiMinutes(checkIn);
    const arrival = checkInMinutes > graceLimit ? "Late" : "On Time";
    if (arrival === "Late") lateDays += 1;
    attendedMinutes += credited;
    days.push({
      date,
      weekday,
      checkIn: clock(checkIn),
      checkOut: clock(checkOut),
      arrival,
      worked: formatMinutes(worked),
      extra: extra ? formatMinutes(extra) : "—",
      short: displayShort(short),
      paid: "—",
      detail: extra ? `Extra ${formatMinutes(extra)}` : short === 0 ? "8 hours complete" : `Short ${formatMinutes(short)}`,
      rawExtraMinutes: extra,
      rawShortMinutes: short,
    });
  }

  let extraPool = days.reduce((sum, day) => sum + day.rawExtraMinutes, 0);
  const extraEarned = extraPool;
  let leavePool = Math.max(0, MONTHLY_LEAVE_MINUTES - allowanceUsedMinutes);
  let extraUsed = 0;
  let leaveCover = 0;
  let finalShort = 0;

  for (const day of days) {
    if (day.rawShortMinutes < 0) continue;
    let gap = day.rawShortMinutes;
    const fromExtra = Math.min(extraPool, gap);
    extraPool -= fromExtra;
    gap -= fromExtra;
    extraUsed += fromExtra;
    const fromLeave = Math.min(leavePool, gap);
    leavePool -= fromLeave;
    gap -= fromLeave;
    leaveCover += fromLeave;
    paidMinutes += fromExtra + fromLeave;
    finalShort += gap;
    day.short = displayShort(gap);
    const notes: string[] = [];
    if (day.rawExtraMinutes) notes.push(`Extra ${formatMinutes(day.rawExtraMinutes)}`);
    if (fromExtra) notes.push(`${formatMinutes(fromExtra)} of this short day is covered by extra hours`);
    if (fromLeave) notes.push(`${formatMinutes(fromLeave)} covered by the 20-hour monthly leave`);
    if (gap) notes.push(`Still short ${formatMinutes(gap)}. Extra hours and the monthly leave are not enough.`);
    if (notes.length) day.detail = notes.join(". ");
  }

  const coverNote = finalShort
    ? `Extra hours and the 20-hour monthly leave are not enough. ${formatMinutes(finalShort)} is still short.`
    : "Short days are covered by extra hours and the 20-hour monthly leave. No hour deduction remains.";

  return {
    from: input.from,
    to: input.to,
    days,
    summary: {
      workingDays: days.length,
      attendedHours: hoursFromMinutes(attendedMinutes),
      paidHours: hoursFromMinutes(paidMinutes),
      extraHours: hoursFromMinutes(extraEarned),
      extraUsedHours: hoursFromMinutes(extraUsed),
      leaveCoverHours: hoursFromMinutes(leaveCover),
      shortHours: hoursFromMinutes(finalShort),
      totalHours: hoursFromMinutes(attendedMinutes + paidMinutes),
      lateDays,
      absentDays,
      leaveDays,
      holidayDays,
      coverNote,
    },
  };
}
