import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Attendance } from "@/modals/Attendance";
import { MonthlyAttendance } from "@/modals/MonthlyAttendance";
import { ActivityLog } from "@/modals/ActivityLog"; 
import CompanyDetails from "@/modals/CompanyDetails";

const TIMEZONE = "Asia/Karachi"; 

export const dynamic = "force-dynamic";

interface AttendanceSettings {
  shiftStart: string;
  shiftEnd: string;
  gracePeriod: number;
  checkInDisplayBefore: number;
  checkOutDisplayAfter: number;
  autoCheckOut: boolean;
}

interface CompanySettingsLean {
  shiftStart?: string;
  shiftEnd?: string;
  gracePeriod?: number;
  checkInDisplayBefore?: number;
  checkOutDisplayAfter?: number;
  autoCheckOut?: boolean;
}

interface MonthlyAttendanceLean {
  presentDays?: number;
  absentDays?: number;
  lateDays?: number;
  leaveDays?: number;
  onDutyDays?: number;
  totalWorkingHours?: number;
  isLocked?: boolean;
}

// Extract exact local date/time parts without server timezone pollution
function getZonedParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10), // 1 - 12
    day: parseInt(map.day, 10),
    hour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    dateStr: `${map.year}-${map.month.toString().padStart(2, "0")}-${map.day.toString().padStart(2, "0")}`,
  };
}

// Safe string formatted date (YYYY-MM-DD)
function getLocalDateString(date: Date = new Date()): string {
  return getZonedParts(date).dateStr;
}

// Day of week in Asia/Karachi (0 = Sunday, 1 = Monday, ...)
function getZonedDayOfWeek(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" });
  const dayStr = formatter.format(date);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.indexOf(dayStr);
}

// Convert "HH:mm" time format to total minutes from midnight
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert local date string ("YYYY-MM-DD") and time string ("HH:mm") to UTC Date object (PKT is UTC+5)
function zonedTimeToUtcDate(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+05:00`);
}

// Fetch DB Configurations safely with complete type casting and fallbacks
async function getActiveSettings(): Promise<AttendanceSettings> {
  const settings = (await CompanyDetails.findOne().lean()) as CompanySettingsLean | null;
  return {
    shiftStart: settings?.shiftStart ?? "09:00",
    shiftEnd: settings?.shiftEnd ?? "17:00",
    gracePeriod: settings?.gracePeriod ?? 15,
    checkInDisplayBefore: settings?.checkInDisplayBefore ?? 30,
    checkOutDisplayAfter: settings?.checkOutDisplayAfter ?? 0,
    autoCheckOut: settings?.autoCheckOut ?? false,
  };
}

// Calculates working hours bounded strictly by configured shift bounds
function calculateBoundedWorkingHours(
  checkIn: Date,
  checkOut: Date,
  recordDateStr: string,
  shiftStartStr: string = "09:00",
  shiftEndStr: string = "17:00"
) {
  const shiftStartUtc = zonedTimeToUtcDate(recordDateStr, shiftStartStr);
  const shiftStartMinutes = timeToMinutes(shiftStartStr);
  const shiftEndMinutes = timeToMinutes(shiftEndStr);
  const isNightShift = shiftEndMinutes < shiftStartMinutes;
  const shiftEndDateStr = isNightShift
    ? (() => {
        const nextDate = new Date(`${recordDateStr}T00:00:00Z`);
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        return nextDate.toISOString().split("T")[0];
      })()
    : recordDateStr;
  const shiftEndUtc = zonedTimeToUtcDate(shiftEndDateStr, shiftEndStr);

  const effectiveCheckIn = Math.max(checkIn.getTime(), shiftStartUtc.getTime());
  const effectiveCheckOut = Math.min(checkOut.getTime(), shiftEndUtc.getTime());

  let diffMs = effectiveCheckOut - effectiveCheckIn;
  if (diffMs < 0) diffMs = 0;

  let diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours > 8) diffHours = 8; // Daily max cap

  const decimalHours = Math.round(diffHours * 100) / 100;
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const formattedDuration = `${hours} hrs ${mins} mins`;

  return { decimalHours, formattedDuration };
}

export async function GET() {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getActiveSettings();
    const todayDateStr = getLocalDateString();
    const now = new Date();
    const zonedNow = getZonedParts(now);
    const currentYear = zonedNow.year;
    const currentMonth = zonedNow.month;

    // Lock past months
    await MonthlyAttendance.updateMany(
      {
        userId,
        $or: [
          { year: { $lt: currentYear } },
          { year: currentYear, month: { $lt: currentMonth } }
        ],
        isLocked: false
      },
      { $set: { isLocked: true } }
    );

    const todayRecord = await Attendance.findOne({ userId, date: todayDateStr }).lean();

    const history = await Attendance.find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const monthlyRecord = (await MonthlyAttendance.findOne({
      userId,
      year: currentYear,
      month: currentMonth
    }).lean()) as MonthlyAttendanceLean | null;

    const monthlyStats = monthlyRecord
      ? {
          presentDays: Math.max(0, monthlyRecord.presentDays ?? 0),
          absentDays: Math.max(0, monthlyRecord.absentDays ?? 0),
          lateDays: Math.max(0, monthlyRecord.lateDays ?? 0),
          leaveDays: Math.max(0, monthlyRecord.leaveDays ?? 0),
          onDutyDays: Math.max(0, monthlyRecord.onDutyDays ?? 0),
          totalWorkingHours: Math.round((monthlyRecord.totalWorkingHours ?? 0) * 100) / 100,
        }
      : null;

    return NextResponse.json({ todayRecord, history, monthlyRecord, monthlyStats, settings }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: "Failed to fetch attendance metrics", details: message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body; 

    if (!action || (action !== "check-in" && action !== "check-out")) {
      return NextResponse.json({ error: "Invalid action type provided" }, { status: 400 });
    }

    const settings = await getActiveSettings();
    const now = new Date();
    const zonedNow = getZonedParts(now);
    const currentYear = zonedNow.year;
    const currentMonth = zonedNow.month;

    // 1. Weekly Off Constraint
    if (getZonedDayOfWeek(now) === 0) {
      return NextResponse.json(
        { error: "Weekly Off: Attendance actions are disabled on Sundays." },
        { status: 400 }
      );
    }

    const todayDateStr = zonedNow.dateStr;

    // 2. Lock System - Automatically lock historical records
    await MonthlyAttendance.updateMany(
      {
        userId,
        $or: [
          { year: { $lt: currentYear } },
          { year: currentYear, month: { $lt: currentMonth } }
        ],
        isLocked: false
      },
      { $set: { isLocked: true } }
    );

    // Lock Check
    const currentMonthlyRecord = await MonthlyAttendance.findOne({
      userId,
      year: currentYear,
      month: currentMonth
    });

    if (currentMonthlyRecord?.isLocked) {
      return NextResponse.json(
        { error: "Your attendance record for this month has been locked and cannot be edited." },
        { status: 400 }
      );
    }

    const currentTimeMinutes = zonedNow.hour * 60 + zonedNow.minute;
    const shiftStartMin = timeToMinutes(settings.shiftStart);
    const checkInDisplayOffset = settings.checkInDisplayBefore;

    if (action === "check-in") {
      // Validate Check-in Window
      const minAllowedCheckIn = shiftStartMin - checkInDisplayOffset;
      if (currentTimeMinutes < minAllowedCheckIn) {
        return NextResponse.json(
          { error: `Check-in is not allowed before ${settings.shiftStart} (Allowed from ${settings.checkInDisplayBefore} mins prior).` },
          { status: 400 }
        );
      }

      const shiftEndMin = timeToMinutes(settings.shiftEnd);
      const checkOutMargin = settings.checkOutDisplayAfter;
      const isNightShift = shiftEndMin < shiftStartMin;
      const isAfterAllowedCheckIn = isNightShift
        ? currentTimeMinutes > shiftEndMin + checkOutMargin &&
          currentTimeMinutes < shiftStartMin - checkInDisplayOffset
        : currentTimeMinutes > shiftEndMin + checkOutMargin;
      if (isAfterAllowedCheckIn) {
        return NextResponse.json(
          {
            error: `Check-in is no longer allowed. The attendance window closed at ${settings.shiftEnd}.`,
          },
          { status: 400 }
        );
      }

      const existingRecord = await Attendance.findOne({ userId, date: todayDateStr });
      if (existingRecord) {
        return NextResponse.json({ error: "Already checked in for today" }, { status: 400 });
      }

      let status: "On Time" | "Late" | "Absent" = "On Time";
      const graceThresholdMinutes = shiftStartMin + settings.gracePeriod;

      if (currentTimeMinutes > graceThresholdMinutes) {
        status = "Late";
      }

      const newRecord = await Attendance.create({
        userId,
        date: todayDateStr,
        checkIn: now,
        status,
      });

      // Update monthly record
      const incPayload: Record<string, number> = { presentDays: 1 };
      if (status === "Late") {
        incPayload.lateDays = 1;
      }

      await MonthlyAttendance.findOneAndUpdate(
        { userId, year: currentYear, month: currentMonth },
        { 
          $inc: incPayload,
          $setOnInsert: { totalWorkingHours: 0, absentDays: 0, leaveDays: 0, onDutyDays: 0, isLocked: false }
        },
        { upsert: true, new: true }
      );

      await ActivityLog.create({
        userId,
        activityType: "CHECK_IN",
        date: todayDateStr,
        timestamp: now,
        description: `Checked in (Status: ${status})`,
        metadata: {
          attendanceId: newRecord._id,
          status,
        },
      });

      return NextResponse.json(
        { message: "Check-in successful", record: newRecord },
        { status: 201 }
      );
    } 
    
    if (action === "check-out") {
      const shiftEndMin = timeToMinutes(settings.shiftEnd);
      const isNightShift = shiftEndMin < shiftStartMin;
      const maxAllowedCheckOut = shiftEndMin + settings.checkOutDisplayAfter;
      const isOutsideCheckOutWindow = isNightShift
        ? currentTimeMinutes > maxAllowedCheckOut && currentTimeMinutes < shiftStartMin
        : currentTimeMinutes > maxAllowedCheckOut;
      if (isOutsideCheckOutWindow) {
        return NextResponse.json(
          {
            error: `Check-out is no longer available. The attendance window closed at ${settings.shiftEnd}.`,
          },
          { status: 400 }
        );
      }

      const existingRecord = await Attendance.findOne({ userId, date: todayDateStr });
      if (!existingRecord) {
        return NextResponse.json(
          { error: "You must check-in first before attempting to check-out" },
          { status: 400 }
        );
      }

      if (existingRecord.checkOut) {
        return NextResponse.json({ error: "Already checked out for today" }, { status: 400 });
      }

      const checkInTime = new Date(existingRecord.checkIn);
      const { decimalHours, formattedDuration } = calculateBoundedWorkingHours(
        checkInTime,
        now,
        todayDateStr,
        settings.shiftStart,
        settings.shiftEnd
      );

      existingRecord.checkOut = now;
      existingRecord.workingHours = decimalHours;
      existingRecord.formattedDuration = formattedDuration;

      await existingRecord.save();

      // Increment total working hours progressively in monthly record
      await MonthlyAttendance.findOneAndUpdate(
        { userId, year: currentYear, month: currentMonth, isLocked: false },
        { 
          $inc: { totalWorkingHours: decimalHours }
        }
      );

      await ActivityLog.create({
        userId,
        activityType: "CHECK_OUT",
        date: todayDateStr,
        timestamp: now,
        description: `Checked out. Duration: ${formattedDuration}`,
        metadata: {
          attendanceId: existingRecord._id,
          workingHours: decimalHours,
          status: existingRecord.status,
        },
      });

      return NextResponse.json(
        { message: "Check-out successful", record: existingRecord },
        { status: 200 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: "Attendance action execution failed", details: message || String(error) },
      { status: 500 }
    );
  }
}