import { NextResponse } from "next/server";
import { getDepartmentHeadContext, getDepartmentMemberUserIds } from "@/lib/department-head";
import {
  getDayAttendanceSheet,
  getUserAttendanceHistory,
} from "@/lib/attendance-service";

export const dynamic = "force-dynamic";

// GET ?date=YYYY-MM-DD           → department day sheet
// GET ?userId=&period=            → single member history (must be in department)
export async function GET(request: Request) {
  try {
    const ctx = await getDepartmentHeadContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Forbidden: Department head access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const userId = searchParams.get("userId");
    const period = searchParams.get("period");

    if (userId) {
      const memberIds = await getDepartmentMemberUserIds(ctx.department, ctx.user.id);
      if (!memberIds.includes(userId)) {
        return NextResponse.json(
          { error: "This employee is outside your department." },
          { status: 403 }
        );
      }
      const history = await getUserAttendanceHistory(userId, period);
      return NextResponse.json(history, { status: 200 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
    }

    const sheet = await getDayAttendanceSheet(date, {
      department: ctx.department,
      scope: "head",
    });

    return NextResponse.json({ ...sheet, department: ctx.department }, { status: 200 });
  } catch (error) {
    console.error("Head attendance GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Check-in and check-out are set by an admin or the attendance editor, not by department heads.
export async function POST() {
  return NextResponse.json(
    { error: "Check-in and check-out can only be set by an administrator." },
    { status: 403 }
  );
}
