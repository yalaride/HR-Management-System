import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Attendance } from "@/modals/Attendance";
import { MonthlyAttendance } from "@/modals/MonthlyAttendance";
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

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Check-in and check-out are recorded on the office fingerprint device and cannot be set from the employee portal.",
    },
    { status: 403 }
  );
}
