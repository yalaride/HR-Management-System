/**
 * Shared attendance operations used by the admin panel and the attendance editor
 * (/api/admin/employee-attendance). Department heads can view their team, but
 * only an admin or the attendance editor can set check-in and check-out.
 */
import dbConnect from "@/lib/mongodb";
import { Attendance } from "@/modals/Attendance";
import { Employee } from "@/modals/Employee";
import { MonthlyAttendance } from "@/modals/MonthlyAttendance";
import CompanyDetails from "@/modals/CompanyDetails";

const TIMEZONE = "Asia/Karachi";

export interface AttendanceSettings {
  shiftStart?: string;
  shiftEnd?: string;
  gracePeriod?: number;
  autoCheckOut?: boolean;
}

/** Returns date formatted as "YYYY-MM-DD" in Asia/Karachi time */
export function getKarachiDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Returns total minutes from midnight in Asia/Karachi time */
function getKarachiMinutes(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === "hour") hours = parseInt(part.value, 10) % 24;
    if (part.type === "minute") minutes = parseInt(part.value, 10);
  }
  return hours * 60 + minutes;
}

/** Converts "HH:MM" string to minutes from midnight */
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map((num) => parseInt(num, 10));
  return (h || 0) * 60 + (m || 0);
}

/** Fetches active settings or defaults */
export async function getActiveSettings() {
  let settings = await CompanyDetails.findOne();
  if (!settings) {
    settings = await CompanyDetails.create({
      shiftStart: "09:00",
      shiftEnd: "17:00",
      gracePeriod: 15,
      checkInDisplayBefore: 30,
      checkOutDisplayAfter: 0,
      autoCheckOut: false,
    });
  }
  return settings;
}

/** Computes daily shift status and working hours (capped at 8h max) */
function computeDailyShiftsAndHours(
  checkInDate: Date | null,
  checkOutDate: Date | null,
  settings: AttendanceSettings
) {
  if (!checkInDate) {
    return { status: "Absent" as const, workingHours: 0, formattedDuration: "" };
  }

  const gracePeriod = typeof settings.gracePeriod === "number" ? settings.gracePeriod : 15;
  const shiftStart = settings.shiftStart || "09:00";
  const shiftEnd = settings.shiftEnd || "17:00";

  const checkInMinutes = getKarachiMinutes(checkInDate);
  const shiftStartMin = timeToMinutes(shiftStart);
  const graceThresholdMinutes = shiftStartMin + gracePeriod;

  let status: "On Time" | "Late" | "Absent" = "On Time";
  if (checkInMinutes > graceThresholdMinutes) {
    status = "Late";
  }

  if (!checkOutDate) {
    return { status, workingHours: 0, formattedDuration: "" };
  }

  const shiftEndMin = timeToMinutes(shiftEnd);
  const checkOutMinutes = getKarachiMinutes(checkOutDate);

  let diffMinutes = 0;
  const isNightShift = shiftEndMin < shiftStartMin;

  if (!isNightShift) {
    const effectiveStartMinutes = Math.max(checkInMinutes, shiftStartMin);
    const effectiveEndMinutes = Math.min(checkOutMinutes, shiftEndMin);
    diffMinutes = Math.max(0, effectiveEndMinutes - effectiveStartMinutes);
  } else {
    const diffMs = checkOutDate.getTime() - checkInDate.getTime();
    diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  }

  // Cap working hours to 8 hours maximum per day
  if (diffMinutes > 8 * 60) {
    diffMinutes = 8 * 60;
  }

  const decimalHours = Math.round((diffMinutes / 60) * 100) / 100;
  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const formattedDuration = `${hrs} hrs ${mins} mins`;

  return { status, workingHours: decimalHours, formattedDuration };
}

/** Recalculates monthly aggregate metrics (never touches isLocked on update) */
async function syncMonthlyAttendanceAggregates(userId: string, year: number, month: number) {
  const monthStr = String(month).padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  const endDate = `${year}-${monthStr}-31`;

  const allMonthlyLogs = await Attendance.find({
    userId,
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  let totalWorkingHours = 0;
  let presentDays = 0;
  let absentDays = 0;

  allMonthlyLogs.forEach((log) => {
    if (log.status === "On Time" || log.status === "Late") {
      presentDays += 1;
    } else if (log.status === "Absent") {
      absentDays += 1;
    }
    totalWorkingHours += log.workingHours || 0;
  });

  totalWorkingHours = Math.round(totalWorkingHours * 100) / 100;

  await MonthlyAttendance.findOneAndUpdate(
    { userId, year, month },
    {
      $set: {
        totalWorkingHours,
        presentDays,
        absentDays,
      },
      $setOnInsert: {
        isLocked: false,
        leaveDays: 0,
        onDutyDays: 0,
      },
    },
    { upsert: true, new: true }
  );
}

/* ────────────────────────── High-level operations ────────────────────────── */

export interface DaySheetOptions {
  /** Restrict results to a single department (department-head scope). */
  department?: string;
  /**
   * "head" hides payroll-sensitive employee fields (salary, hourlyRate).
   * "admin" returns full employee documents.
   */
  scope: "admin" | "head";
}

/** Day view: employees + logs + monthly lock records + settings */
export async function getDayAttendanceSheet(date: string, options: DaySheetOptions) {
  await dbConnect();

  const todayStr = getKarachiDateString();
  const [currentYear, currentMonth] = todayStr.split("-").map((n) => parseInt(n, 10));

  const parts = date.split("-");
  const year = parseInt(parts[0], 10) || currentYear;
  const month = parseInt(parts[1], 10) || currentMonth;

  const settings = await getActiveSettings();

  const employeeQuery: Record<string, unknown> = { status: { $ne: "Inactive" } };
  if (options.department) {
    employeeQuery.department = options.department;
  }

  const employeeFind = Employee.find(employeeQuery);
  if (options.scope === "head") {
    // Heads must never receive payroll data
    employeeFind.select("userId name designation department employeeId profilePhotoUrl status joinDate");
  }

  const [employees, allLogs, allMonthlyRecords] = await Promise.all([
    employeeFind.lean(),
    Attendance.find({ date }).lean(),
    MonthlyAttendance.find({ year, month }).lean(),
  ]);

  type LeanEmployeeDoc = Record<string, unknown> & { userId?: unknown; shiftTime?: string };
  const employeeDocs = (employees || []) as LeanEmployeeDoc[];

  let logs = allLogs;
  let monthlyRecords = allMonthlyRecords;

  if (options.department) {
    const memberIds = new Set(employeeDocs.map((e) => String(e.userId ?? "")));
    logs = allLogs.filter((l) => memberIds.has(String(l.userId)));
    monthlyRecords = allMonthlyRecords.filter((r) => memberIds.has(String(r.userId)));
  }

  const shiftStart = settings?.shiftStart || "09:00";
  const shiftEnd = settings?.shiftEnd || "17:00";
  const shiftTimeLabel = `${shiftStart}-${shiftEnd}`;

  const enrichedEmployees = employeeDocs.map((e) => ({
    ...e,
    shiftTime: e?.shiftTime || shiftTimeLabel,
  }));

  return {
    employees: enrichedEmployees,
    logs,
    monthlyRecords,
    shiftTimeLabel,
    companySettings: settings,
  };
}

/** Per-employee history with stats and month-lock state */
export async function getUserAttendanceHistory(userId: string, period: string | null) {
  await dbConnect();
  await getActiveSettings();

  const todayStr = getKarachiDateString();
  const [currentYear, currentMonth] = todayStr.split("-").map((n) => parseInt(n, 10));

  const query: Record<string, unknown> = { userId };

  if (period === "this-month") {
    const monthStr = String(currentMonth).padStart(2, "0");
    query.date = { $gte: `${currentYear}-${monthStr}-01`, $lte: `${currentYear}-${monthStr}-31` };
  } else if (period === "last-month") {
    let lastMonth = currentMonth - 1;
    let lastYear = currentYear;
    if (lastMonth === 0) {
      lastMonth = 12;
      lastYear = currentYear - 1;
    }
    const lastMonthStr = String(lastMonth).padStart(2, "0");
    query.date = { $gte: `${lastYear}-${lastMonthStr}-01`, $lte: `${lastYear}-${lastMonthStr}-31` };
  }

  const logs = await Attendance.find(query).sort({ date: -1 }).lean();

  const totalDays = logs.length;
  const onTimeDays = logs.filter((l) => l.status === "On Time").length;
  const lateDays = logs.filter((l) => l.status === "Late").length;
  const absentDays = logs.filter((l) => l.status === "Absent").length;
  const totalHours = logs.reduce((sum, l) => sum + (l.workingHours || 0), 0);

  const presenceCount = onTimeDays + lateDays;
  const attendanceRate = totalDays > 0 ? Math.round((presenceCount / totalDays) * 100) : 0;

  const targetMonth =
    period === "this-month"
      ? currentMonth
      : period === "last-month"
        ? currentMonth === 1
          ? 12
          : currentMonth - 1
        : null;
  const targetYear = period === "last-month" && currentMonth === 1 ? currentYear - 1 : currentYear;

  let isLocked = false;
  if (targetMonth) {
    const lockObj = await MonthlyAttendance.findOne({
      userId,
      year: targetYear,
      month: targetMonth,
    }).lean();
    isLocked = lockObj ? lockObj.isLocked : false;
  }

  return {
    logs,
    isLocked,
    stats: {
      totalDays,
      onTimeDays,
      lateDays,
      absentDays,
      totalHours: Number(totalHours.toFixed(2)),
      attendanceRate,
    },
  };
}

export interface UpsertAttendanceInput {
  userId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status?: string | null;
}

export type UpsertAttendanceResult =
  | { ok: true; record: unknown }
  | { ok: false; status: number; error: string };

/** Manual/retro attendance entry — same rules for admin and department head */
export async function upsertAttendanceRecord(
  input: UpsertAttendanceInput
): Promise<UpsertAttendanceResult> {
  await dbConnect();

  const { userId, date, checkIn, checkOut, status } = input;

  if (!userId || !date) {
    return { ok: false, status: 400, error: "Missing required fields: userId and date" };
  }

  const todayStr = getKarachiDateString();
  if (date > todayStr) {
    return { ok: false, status: 400, error: "Cannot register attendance for future dates." };
  }

  const parts = date.split("-");
  const year = parseInt(parts[0], 10) || parseInt(todayStr.split("-")[0], 10);
  const month = parseInt(parts[1], 10) || parseInt(todayStr.split("-")[1], 10);

  const monthlyLockCheck = await MonthlyAttendance.findOne({ userId, year, month }).lean();
  if (monthlyLockCheck?.isLocked) {
    return {
      ok: false,
      status: 400,
      error: "Changes blocked: This month's attendance logs are finalized and locked.",
    };
  }

  const settings = await getActiveSettings();
  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;

  const calculations = computeDailyShiftsAndHours(checkInDate, checkOutDate, settings);
  const finalStatus = status ? status : calculations.status;

  const updatePayload: Record<string, unknown> = {
    userId,
    date,
    status: finalStatus,
  };

  const updateQuery: Record<string, unknown> = {};

  if (finalStatus === "Absent") {
    updatePayload.workingHours = 0;
    updatePayload.formattedDuration = "";
    updateQuery.$set = updatePayload;
    updateQuery.$unset = { checkIn: "", checkOut: "" };
  } else {
    if (checkInDate) {
      updatePayload.checkIn = checkInDate;
    }
    if (checkInDate && checkOutDate) {
      updatePayload.checkOut = checkOutDate;
      updatePayload.workingHours = calculations.workingHours;
      updatePayload.formattedDuration = calculations.formattedDuration;
      updateQuery.$set = updatePayload;
    } else {
      updateQuery.$set = updatePayload;
      updateQuery.$unset = { checkOut: "", workingHours: "", formattedDuration: "" };
    }
  }

  const updatedRecord = await Attendance.findOneAndUpdate({ userId, date }, updateQuery, {
    new: true,
    upsert: true,
    runValidators: true,
  }).lean();

  await syncMonthlyAttendanceAggregates(userId, year, month);

  return { ok: true, record: updatedRecord };
}
