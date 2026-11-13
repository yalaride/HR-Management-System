/**
 * Shared attendance operations used by the admin panel and the attendance editor
 * (/api/admin/employee-attendance). Department heads can view their team, but
 * only an admin or the attendance editor can set check-in and check-out.
 */
import dbConnect from "@/lib/mongodb";
import { Attendance } from "@/modals/Attendance";
import { AttendanceOmission } from "@/modals/AttendanceOmission";
import { Employee } from "@/modals/Employee";
import { MonthlyAttendance } from "@/modals/MonthlyAttendance";
import { ActivityLog } from "@/modals/ActivityLog";
import CompanyDetails from "@/modals/CompanyDetails";
import { Holiday } from "@/modals/Holiday";
import Leave from "@/modals/LeaveRequest";
import { buildAttendanceReport, eachDate, isFutureFingerprint, isShiftStartMarker } from "@/lib/attendance-report";

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

  // Credit the real time between check-in and check-out, up to 8 hours.
  // A late arrival that still completes 8 hours has no hour shortfall.
  void shiftEnd;
  let diffMinutes = Math.max(0, Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000));
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

  const employeeQuery: Record<string, unknown> = { status: { $nin: ["Inactive", "Terminated"] } };
  if (options.department) {
    employeeQuery.department = options.department;
  }

  const employeeFind = Employee.find(employeeQuery);
  if (options.scope === "head") {
    // Heads must never receive payroll data
    employeeFind.select("userId name designation department employeeId profilePhotoUrl status joinDate");
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const [employees, allLogs, allMonthlyRecords, holiday, approvedLeaves] = await Promise.all([
    employeeFind.lean(),
    Attendance.find({ date }).lean(),
    MonthlyAttendance.find({ year, month }).lean(),
    Holiday.findOne({ startDate: { $lte: date }, endDate: { $gte: date } })
      .select("title startDate endDate")
      .lean<{ title: string; startDate: string; endDate: string } | null>(),
    Leave.find({
      status: "APPROVED",
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    })
      .select("userId type")
      .lean<{ userId?: string; type?: string }[]>(),
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

  const cleanedLogs = await stripInvalidCheckouts(logs);

  return {
    employees: enrichedEmployees,
    logs: cleanedLogs,
    monthlyRecords,
    shiftTimeLabel,
    companySettings: settings,
    holiday: holiday ? { title: holiday.title, startDate: holiday.startDate, endDate: holiday.endDate } : null,
    leaves: approvedLeaves.map((leave) => ({
      userId: String(leave.userId || ""),
      type: String(leave.type || ""),
    })),
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

  const monthStr = String(currentMonth).padStart(2, "0");
  let rangeFrom = `${currentYear}-${monthStr}-01`;
  let rangeTo = todayStr;
  if (period === "last-month") {
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const lastMonthStr = String(lastMonth).padStart(2, "0");
    const lastDay = new Date(Date.UTC(lastYear, lastMonth, 0)).getUTCDate();
    rangeFrom = `${lastYear}-${lastMonthStr}-01`;
    rangeTo = `${lastYear}-${lastMonthStr}-${String(lastDay).padStart(2, "0")}`;
  } else if (period === "all") {
    rangeFrom = `${currentYear}-01-01`;
  }

  const employee = await Employee.findOne({ userId })
    .select("name designation department joinDate")
    .lean<{ name?: string; designation?: string; department?: string; joinDate?: Date | null } | null>();
  const joinDate = employee?.joinDate ? getKarachiDateString(new Date(employee.joinDate)) : "";
  if (joinDate && joinDate > rangeFrom) rangeFrom = joinDate;
  if (rangeFrom > rangeTo) rangeFrom = rangeTo;

  const [holidays, leaves, omissions] = await Promise.all([
    Holiday.find({ startDate: { $lte: rangeTo }, endDate: { $gte: rangeFrom } })
      .select("title startDate endDate")
      .lean<{ title: string; startDate: string; endDate: string }[]>(),
    Leave.find({
      userId,
      status: "APPROVED",
      startDate: { $lte: new Date(`${rangeTo}T23:59:59+05:00`) },
      endDate: { $gte: new Date(`${rangeFrom}T00:00:00+05:00`) },
    })
      .select("type status startDate endDate")
      .lean<{ type: string; status: string; startDate: Date; endDate: Date }[]>(),
    AttendanceOmission.find({ userId, date: { $gte: rangeFrom, $lte: rangeTo } })
      .select("date")
      .lean<{ date: string }[]>(),
  ]);

  const settingsForReport = await getActiveSettings();
  const cleanedLogs = await stripInvalidCheckouts(logs);
  const report = buildAttendanceReport({
    from: rangeFrom,
    to: rangeTo,
    today: todayStr,
    shiftStart: settingsForReport.shiftStart || "09:00",
    shiftEnd: settingsForReport.shiftEnd || "17:00",
    gracePeriod: typeof settingsForReport.gracePeriod === "number" ? settingsForReport.gracePeriod : 15,
    punches: cleanedLogs.map((log) => ({
      date: log.date,
      checkIn: log.checkIn,
      checkOut: log.checkOut,
      status: log.status,
    })),
    leaves: leaves.map((leave) => ({
      type: leave.type,
      status: leave.status,
      startDate: new Date(leave.startDate).toISOString().slice(0, 10),
      endDate: new Date(leave.endDate).toISOString().slice(0, 10),
    })),
    holidays,
    omittedDates: omissions.map((item) => item.date),
  });

  const lastMonthNumber = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const lastMonthKey = String(lastMonthNumber).padStart(2, "0");
  const lastMonthRecords = await Attendance.countDocuments({
    userId,
    date: {
      $gte: `${lastMonthYear}-${lastMonthKey}-01`,
      $lte: `${lastMonthYear}-${lastMonthKey}-31`,
    },
  });

  return {
    logs: cleanedLogs,
    isLocked,
    hasLastMonth: lastMonthRecords > 0,
    report,
    employee: {
      name: employee?.name || "",
      designation: employee?.designation || "",
      department: employee?.department || "",
    },
    stats: {
      totalDays,
      onTimeDays,
      lateDays,
      absentDays: report.summary.absentDays,
      totalHours: report.summary.totalHours,
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
  const finalStatus = status === "Absent" || !checkInDate ? "Absent" : null;

  if (finalStatus === "Absent") {
    await Attendance.deleteOne({ userId, date });
    await AttendanceOmission.deleteOne({ userId, date });
    await syncMonthlyAttendanceAggregates(userId, year, month);
    return { ok: true, record: null };
  }

  const calculations = computeDailyShiftsAndHours(checkInDate, checkOutDate, settings);
  // Arrival status follows the saved check-in time. A corrected time clears an old Late flag.
  const savedStatus = calculations.status;

  const updatePayload: Record<string, unknown> = {
    userId,
    date,
    status: savedStatus,
    checkIn: checkInDate,
  };
  const updateQuery: Record<string, unknown> = { $set: updatePayload };

  if (checkOutDate) {
    updatePayload.checkOut = checkOutDate;
    updatePayload.workingHours = calculations.workingHours;
    updatePayload.formattedDuration = calculations.formattedDuration;
  } else {
    updateQuery.$unset = { checkOut: "", workingHours: "", formattedDuration: "" };
  }

  const updatedRecord = await Attendance.findOneAndUpdate({ userId, date }, updateQuery, {
    new: true,
    upsert: true,
    runValidators: true,
  }).lean();

  await AttendanceOmission.deleteOne({ userId, date });
  await syncMonthlyAttendanceAggregates(userId, year, month);

  return { ok: true, record: updatedRecord };
}

export type DeleteAttendanceResult =
  | { ok: true; deleted: number; skippedLocked: number }
  | { ok: false; status: number; error: string };

function attendanceHistoryRange(period: "this-month" | "last-month" | "all"): { from?: string; to?: string } {
  const todayStr = getKarachiDateString();
  const [currentYear, currentMonth] = todayStr.split("-").map((part) => parseInt(part, 10));
  if (period === "this-month") {
    const monthStr = String(currentMonth).padStart(2, "0");
    return { from: `${currentYear}-${monthStr}-01`, to: `${currentYear}-${monthStr}-31` };
  }
  if (period === "last-month") {
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const lastMonthStr = String(lastMonth).padStart(2, "0");
    return { from: `${lastYear}-${lastMonthStr}-01`, to: `${lastYear}-${lastMonthStr}-31` };
  }
  return {};
}

function isSunday(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

/** Working days in the history window, excluding Sundays, holidays, and approved leave. */
async function historyDaysToRemove(userId: string, from: string, to: string): Promise<string[]> {
  const today = getKarachiDateString();
  const end = to < today ? to : today;
  const employee = await Employee.findOne({ userId })
    .select("joinDate")
    .lean<{ joinDate?: Date | null } | null>();
  let start = from;
  if (employee?.joinDate) {
    const join = getKarachiDateString(new Date(employee.joinDate));
    if (join > start) start = join;
  }
  if (start > end) return [];

  const [holidays, leaves] = await Promise.all([
    Holiday.find({ startDate: { $lte: end }, endDate: { $gte: start } })
      .select("startDate endDate")
      .lean<{ startDate: string; endDate: string }[]>(),
    Leave.find({
      userId,
      status: "APPROVED",
      startDate: { $lte: new Date(`${end}T23:59:59+05:00`) },
      endDate: { $gte: new Date(`${start}T00:00:00+05:00`) },
    })
      .select("startDate endDate")
      .lean<{ startDate: Date; endDate: Date }[]>(),
  ]);

  return eachDate(start, end).filter((date) => {
    if (isSunday(date)) return false;
    if (holidays.some((holiday) => holiday.startDate <= date && holiday.endDate >= date)) return false;
    return !leaves.some((leave) => {
      const leaveStart = getKarachiDateString(new Date(leave.startDate));
      const leaveEnd = getKarachiDateString(new Date(leave.endDate));
      return leaveStart <= date && leaveEnd >= date;
    });
  });
}

/** Removes a history day, including a calculated absent day that has no saved punch. */
export async function deleteAttendanceHistory(input: {
  userId: string;
  date?: string;
  period?: "this-month" | "last-month" | "all";
}): Promise<DeleteAttendanceResult> {
  await dbConnect();

  const userId = input.userId?.trim();
  if (!userId) {
    return { ok: false, status: 400, error: "Select an employee first." };
  }
  if (!input.date && !input.period) {
    return { ok: false, status: 400, error: "Choose a day or a history period to delete." };
  }
  if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, status: 400, error: "Invalid attendance date." };
  }

  const today = getKarachiDateString();
  let dates: string[] = [];
  if (input.date) {
    if (input.date > today) {
      return { ok: false, status: 400, error: "A future day cannot be deleted." };
    }
    dates = [input.date];
  } else if (input.period) {
    const range =
      input.period === "all"
        ? { from: `${today.slice(0, 4)}-01-01`, to: today }
        : attendanceHistoryRange(input.period);
    dates = await historyDaysToRemove(userId, range.from || `${today.slice(0, 4)}-01-01`, range.to || today);
  }

  if (!dates.length) {
    return { ok: false, status: 404, error: "No attendance days to delete." };
  }

  await AttendanceOmission.bulkWrite(
    dates.map((date) => ({
      updateOne: {
        filter: { userId, date },
        update: { $setOnInsert: { userId, date } },
        upsert: true,
      },
    }))
  );

  const removedLogs = await Attendance.find({ userId, date: { $in: dates } }).select("date").lean<{ date: string }[]>();
  if (removedLogs.length) {
    await Attendance.deleteMany({ userId, date: { $in: dates } });
    const months = new Set<string>();
    for (const log of removedLogs) {
      const [year, month] = log.date.split("-").map((part) => parseInt(part, 10));
      if (year && month) months.add(`${year}|${month}`);
    }
    for (const key of months) {
      const [year, month] = key.split("|").map(Number);
      await syncMonthlyAttendanceAggregates(userId, year, month);
    }
  }

  await ActivityLog.create({
    userId,
    activityType: "ATTENDANCE_DELETED",
    date: dates[0],
    timestamp: new Date(),
    description:
      dates.length === 1
        ? `Attendance history for ${dates[0]} was deleted`
        : `${dates.length} attendance history days were deleted`,
  });

  return { ok: true, deleted: dates.length, skippedLocked: 0 };
}

const CHECKOUT_MIN_GAP_MS = 15 * 60 * 1000;

type PunchLog = {
  _id?: unknown;
  userId?: unknown;
  date?: string;
  checkIn?: Date | null;
  checkOut?: Date | null;
  workingHours?: number;
  formattedDuration?: string;
};

/** Drops a checkout that has not happened yet, or that is earlier than check-in. */
async function stripInvalidCheckouts<T extends PunchLog>(logs: T[], now = new Date()): Promise<T[]> {
  const repairs: Promise<unknown>[] = [];
  const months = new Set<string>();

  const cleaned = logs.map((log) => {
    const checkIn = log.checkIn ? new Date(log.checkIn) : null;
    const checkOut = log.checkOut ? new Date(log.checkOut) : null;
    const checkInOk = Boolean(checkIn && !Number.isNaN(checkIn.getTime()));
    const checkOutOk =
      Boolean(checkOut) &&
      checkInOk &&
      !isFutureFingerprint(checkOut as Date, now) &&
      (checkOut as Date).getTime() - (checkIn as Date).getTime() >= CHECKOUT_MIN_GAP_MS;

    if (!log.checkOut || checkOutOk) return log;

    if (log._id) {
      repairs.push(
        Attendance.updateOne(
          { _id: log._id },
          { $unset: { checkOut: 1, workingHours: 1, formattedDuration: 1 } }
        )
      );
      if (log.userId && log.date) {
        const [year, month] = log.date.split("-").map((part) => parseInt(part, 10));
        if (year && month) months.add(`${String(log.userId)}|${year}|${month}`);
      }
    }

    return { ...log, checkOut: null, workingHours: 0, formattedDuration: "" };
  });

  if (repairs.length) {
    await Promise.all(repairs);
    for (const key of months) {
      const [userId, year, month] = key.split("|");
      await syncMonthlyAttendanceAggregates(userId, Number(year), Number(month));
    }
  }

  return cleaned;
}

export type DevicePunchResult =
  | { ok: true; action: "check-in" | "check-out" | "duplicate"; status: string }
  | { ok: false; status: number; error: string };

/**
 * Fingerprint punch. The first punch of the Karachi day is check-in.
 * A later punch updates check-out and keeps the original check-in.
 */
export async function recordDevicePunch(input: {
  userId: string;
  punchedAt: Date;
}): Promise<DevicePunchResult> {
  await dbConnect();

  const { userId, punchedAt } = input;
  if (!userId || Number.isNaN(punchedAt.getTime())) {
    return { ok: false, status: 400, error: "Invalid fingerprint punch." };
  }

  const date = getKarachiDateString(punchedAt);
  const todayStr = getKarachiDateString();
  if (date > todayStr) {
    return { ok: false, status: 400, error: "Fingerprint punch is in the future." };
  }

  const [year, month] = date.split("-").map((part) => parseInt(part, 10));
  const monthlyLockCheck = await MonthlyAttendance.findOne({ userId, year, month }).lean();
  if (monthlyLockCheck?.isLocked) {
    return {
      ok: false,
      status: 400,
      error: "This month's attendance logs are finalized and locked.",
    };
  }

  const settings = await getActiveSettings();
  const existing = await Attendance.findOne({ userId, date });
  const now = new Date();
  const shiftStart = settings.shiftStart || "09:00";

  const asDate = (value: Date | null | undefined) => {
    if (!value) return null;
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? null : instant;
  };

  const storedCheckIn = asDate(existing?.checkIn);
  const storedCheckOut = asDate(existing?.checkOut);
  const usableCheckIn =
    storedCheckIn && !isFutureFingerprint(storedCheckIn, now) ? storedCheckIn : null;
  const storedCheckOutUsable =
    storedCheckOut &&
    usableCheckIn &&
    !isFutureFingerprint(storedCheckOut, now) &&
    storedCheckOut.getTime() - usableCheckIn.getTime() >= CHECKOUT_MIN_GAP_MS
      ? storedCheckOut
      : null;

  const shiftStartMarker = isShiftStartMarker(punchedAt, now, shiftStart);
  const incomingUsable =
    !isFutureFingerprint(punchedAt, now) &&
    !(shiftStartMarker && (!usableCheckIn || punchedAt.getTime() <= usableCheckIn.getTime()));

  const stamps = [usableCheckIn, storedCheckOutUsable, incomingUsable ? punchedAt : null]
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime());

  if (!stamps.length) {
    return { ok: true, action: "duplicate", status: existing?.status || "On Time" };
  }

  const earliest = new Date(Math.min(...stamps));
  const latest = new Date(Math.max(...stamps));
  const nextCheckIn = earliest;
  const nextCheckOut =
    latest.getTime() - earliest.getTime() >= CHECKOUT_MIN_GAP_MS ? latest : null;

  const previousCheckIn = storedCheckIn ? storedCheckIn.getTime() : null;
  const previousCheckOut = storedCheckOut ? storedCheckOut.getTime() : null;
  const checkInChanged = previousCheckIn !== nextCheckIn.getTime();
  const checkOutChanged = (previousCheckOut ?? null) !== (nextCheckOut ? nextCheckOut.getTime() : null);

  if (!checkInChanged && !checkOutChanged) {
    return { ok: true, action: "duplicate", status: existing?.status || "On Time" };
  }

  const checkOut = nextCheckOut;
  const action: "check-in" | "check-out" | "duplicate" =
    !incomingUsable
      ? "duplicate"
      : checkOut && punchedAt.getTime() === checkOut.getTime() && punchedAt.getTime() !== nextCheckIn.getTime()
        ? "check-out"
        : "check-in";

  const calculations = computeDailyShiftsAndHours(nextCheckIn, checkOut, settings);
  const updatePayload: Record<string, unknown> = {
    userId,
    date,
    checkIn: nextCheckIn,
    status: calculations.status,
  };
  const updateQuery: Record<string, unknown> = { $set: updatePayload };

  if (checkOut) {
    updatePayload.checkOut = checkOut;
    updatePayload.workingHours = calculations.workingHours;
    updatePayload.formattedDuration = calculations.formattedDuration;
  } else {
    updateQuery.$unset = { checkOut: "", workingHours: "", formattedDuration: "" };
  }

  const updatedRecord = await Attendance.findOneAndUpdate({ userId, date }, updateQuery, {
    new: true,
    upsert: true,
    runValidators: true,
  });

  await AttendanceOmission.deleteOne({ userId, date });
  await syncMonthlyAttendanceAggregates(userId, year, month);

  if (updatedRecord && action !== "duplicate") {
    await ActivityLog.create({
      userId,
      activityType: action === "check-out" ? "CHECK_OUT" : "CHECK_IN",
      date,
      timestamp: punchedAt,
      description:
        action === "check-out"
          ? "Fingerprint check-out recorded"
          : "Fingerprint check-in recorded",
      metadata: {
        attendanceId: updatedRecord._id,
        status: calculations.status,
        workingHours: calculations.workingHours,
      },
    });
  }

  return { ok: true, action, status: calculations.status };
}
