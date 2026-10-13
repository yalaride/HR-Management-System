import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Attendance } from "@/modals/Attendance";
import { MonthlyAttendance } from "@/modals/MonthlyAttendance";
import CompanyDetails from "@/modals/CompanyDetails";

export const dynamic = "force-dynamic";

const TIMEZONE = "Asia/Karachi";

/** Returns date formatted as "YYYY-MM-DD" in Asia/Karachi time */
function getKarachiDateString(date: Date = new Date()): string {
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

/** Computes daily shift status, working hours (capped at 8h), and formatted duration */
function computeDailyShiftsAndHours(
  checkInDate: Date | null,
  checkOutDate: Date | null,
  settings: { shiftStart?: string; shiftEnd?: string; gracePeriod?: number }
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

  if (diffMinutes > 8 * 60) {
    diffMinutes = 8 * 60;
  }

  const decimalHours = Math.round((diffMinutes / 60) * 100) / 100;
  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const formattedDuration = `${hrs} hrs ${mins} mins`;

  return { status, workingHours: decimalHours, formattedDuration };
}

/** Syncs monthly aggregates */
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

  // Never overwrite isLocked on update — locked payroll months must stay locked.
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

/** Main execution function for Cron job */
async function executeAutoCheckoutProcess() {
  await dbConnect();

  const settings = await CompanyDetails.findOne();
  if (!settings || !settings.autoCheckOut) {
    return { executed: false, message: "Auto check-out is disabled in settings." };
  }

  const todayStr = getKarachiDateString();
  // The Vercel schedule runs once daily at 8:00 PM Asia/Karachi.
  // Search for unclosed check-ins for today or past days.
  const unclosedLogs = await Attendance.find({
    checkIn: { $exists: true, $ne: null },
    $or: [{ checkOut: { $exists: false } }, { checkOut: null }],
  }).lean();

  let autoCheckedOutCount = 0;

  for (const log of unclosedLogs) {
    // Do not alter future dates
    if (log.date > todayStr) {
      continue;
    }

    const [yearStr, monthStr] = log.date.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const monthlyLockCheck = await MonthlyAttendance.findOne({ userId: log.userId, year, month }).lean();
    if (monthlyLockCheck?.isLocked) {
      continue;
    }

    const checkoutISO = `${log.date}T${settings.shiftEnd || "17:00"}:00+05:00`;
    let checkOutDate = new Date(checkoutISO);

    if (log.checkIn && checkOutDate.getTime() < new Date(log.checkIn).getTime()) {
      checkOutDate = new Date(log.checkIn);
    }

    const calculations = computeDailyShiftsAndHours(log.checkIn, checkOutDate, settings);

    await Attendance.updateOne(
      { _id: log._id },
      {
        $set: {
          checkOut: checkOutDate,
          workingHours: calculations.workingHours,
          formattedDuration: calculations.formattedDuration,
          status: calculations.status,
        },
      }
    );

    await syncMonthlyAttendanceAggregates(log.userId, year, month);
    autoCheckedOutCount++;
  }

  return {
    executed: true,
    autoCheckedOutCount,
    message: `Auto check-out processed successfully. Closed ${autoCheckedOutCount} open shift(s).`,
  };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();

    // CRON_SECRET is mandatory — without it this endpoint stays locked.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger." }, { status: 401 });
    }

    const result = await executeAutoCheckoutProcess();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Cron Auto Checkout Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}