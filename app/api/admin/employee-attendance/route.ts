import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canManuallyEditAttendance } from "@/lib/audit-log-access";
import {
  getDayAttendanceSheet,
  getUserAttendanceHistory,
  upsertAttendanceRecord,
} from "@/lib/attendance-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!canManuallyEditAttendance(user)) {
      return NextResponse.json({ error: "Forbidden: You cannot view attendance records." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const userId = searchParams.get("userId");
    const period = searchParams.get("period");

    if (userId) {
      const history = await getUserAttendanceHistory(userId, period);
      return NextResponse.json(history, { status: 200 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
    }

    const sheet = await getDayAttendanceSheet(date, { scope: "admin" });
    return NextResponse.json(sheet, { status: 200 });
  } catch (error) {
    console.error("Attendance API GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!canManuallyEditAttendance(user)) {
      return NextResponse.json({ error: "Forbidden: You cannot set check-in or check-out." }, { status: 403 });
    }

    const body = await request.json();
    const result = await upsertAttendanceRecord({
      userId: body.userId,
      date: body.date,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      status: body.status,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, record: result.record }, { status: 200 });
  } catch (error) {
    console.error("Attendance API POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
