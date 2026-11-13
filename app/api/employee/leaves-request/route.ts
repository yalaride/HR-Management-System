"use server";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import connectDB from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import Leave from "@/modals/LeaveRequest";
import { Employee } from "@/modals/Employee";
import { ActivityLog } from "@/modals/ActivityLog";
import {
  earliestEmployeeStart,
  karachiToday,
  monthKey,
  monthUsage,
  shiftMonth,
  validateEmployeeLeave,
  type QuotaLeave,
} from "@/lib/monthly-leave";

interface SessionUser {
  id?: string;
  userId?: string;
  role?: string;
  name?: string | null;
}

interface EmployeeInfo {
  name?: string;
  designation?: string;
  employmentType?: string;
  confirmationDate?: Date | string | null;
  joinDate?: Date | string | null;
}

function formatDate(value: unknown): string {
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
}

async function getEmployee(userId: string): Promise<EmployeeInfo | null> {
  return Employee.findOne({ userId })
    .select("name designation employmentType confirmationDate joinDate")
    .lean<EmployeeInfo>();
}

export async function GET() {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    const currentUser = session?.user as SessionUser | undefined;
    const userId = String(currentUser?.id || currentUser?.userId || "");

    if (!currentUser || !userId) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (String(currentUser.role || "employee").toUpperCase() !== "EMPLOYEE") {
      return NextResponse.json({ error: "Forbidden: Employee access required." }, { status: 403 });
    }

    const employee = await getEmployee(userId);
    const employmentType = employee?.employmentType || "Probation";
    const canUseLeave = ["permanent", "contract"].includes(employmentType.toLowerCase());

    const leaves = await Leave.find({ userId }).sort({ createdAt: -1 }).lean();
    const formattedLeaves = leaves.map((leave) => ({
      id: String(leave._id),
      type: String(leave.type || "").toUpperCase(),
      startDate: formatDate(leave.startDate),
      endDate: formatDate(leave.endDate),
      days: Number(leave.days || 0),
      reason: String(leave.reason || ""),
      status: String(leave.status || "PENDING").toUpperCase(),
    }));

    const today = karachiToday();
    const currentMonth = monthKey(today);
    const nextMonth = shiftMonth(currentMonth, 1);
    const quotaLeaves: QuotaLeave[] = formattedLeaves.map((leave) => ({
      type: leave.type,
      status: leave.status,
      startDate: leave.startDate,
      endDate: leave.endDate,
    }));
    const currentUsage = monthUsage(quotaLeaves, currentMonth);
    const nextUsage = monthUsage(quotaLeaves, nextMonth);

    return NextResponse.json({
      leaves: formattedLeaves,
      quota: {
        fullDays: 2,
        halfDays: 1,
        noticeDays: 2,
        earliestStart: earliestEmployeeStart(today),
        currentMonth: {
          month: currentMonth,
          label: new Date(`${currentMonth}-01T00:00:00.000Z`).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }),
          fullUsed: currentUsage.full,
          fullRemaining: Math.max(0, 2 - currentUsage.full),
          halfUsed: currentUsage.half,
          halfRemaining: Math.max(0, 1 - currentUsage.half),
        },
        nextMonth: {
          month: nextMonth,
          fullRemaining: Math.max(0, 2 - nextUsage.full),
          halfRemaining: Math.max(0, 1 - nextUsage.half),
        },
      },
      employmentType,
      canRequestLeave: canUseLeave,
    });
  } catch (error) {
    console.error("Employee leaves GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    const currentUser = session?.user as SessionUser | undefined;
    const userId = String(currentUser?.id || currentUser?.userId || "");

    if (!currentUser || !userId) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (String(currentUser.role || "employee").toUpperCase() !== "EMPLOYEE") {
      return NextResponse.json({ error: "Forbidden: Employee access required." }, { status: 403 });
    }

    const employee = await getEmployee(userId);
    const employmentType = employee?.employmentType || "Probation";
    if (!["permanent", "contract"].includes(employmentType.toLowerCase())) {
      return NextResponse.json(
        { error: "Leave requests are available only for Permanent or Contract employees." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      type?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    };
    const type = String(body.type || "").toUpperCase();
    if (!["FULL", "HALF"].includes(type) || !body.startDate || !body.endDate || !body.reason?.trim()) {
      return NextResponse.json(
        { error: "Choose a full day or a half day, the dates, and a reason." },
        { status: 400 }
      );
    }

    const today = karachiToday();
    const existingLeaves = await Leave.find({ userId }).select("type status startDate endDate").lean();
    const existing: QuotaLeave[] = existingLeaves.map((leave) => ({
      type: String(leave.type || ""),
      status: String(leave.status || ""),
      startDate: formatDate(leave.startDate),
      endDate: formatDate(leave.endDate),
    }));
    const checked = validateEmployeeLeave({
      kind: type as "FULL" | "HALF",
      start: body.startDate,
      end: body.endDate,
      today,
      existing,
    });
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }

    const startDay = new Date(`${body.startDate}T00:00:00.000Z`);
    const endDayExclusive = new Date(`${body.endDate}T00:00:00.000Z`);
    endDayExclusive.setUTCDate(endDayExclusive.getUTCDate() + 1);
    const overlappingLeave = await Leave.findOne({
      userId,
      status: { $in: ["PENDING", "APPROVED"] },
      startDate: { $lt: endDayExclusive },
      endDate: { $gte: startDay },
    }).lean();
    if (overlappingLeave) {
      return NextResponse.json(
        { error: "One of these days is already in another leave request." },
        { status: 409 }
      );
    }

    const days = checked.days;
    const start = startDay;
    const end = new Date(`${body.endDate}T00:00:00.000Z`);

    const employeeName = employee?.name || currentUser.name || "Employee";
    const designation = employee?.designation || "Staff Member";
    const newRequest = await Leave.create({
      userId,
      employeeName,
      designation,
      type,
      startDate: start,
      endDate: end,
      days,
      reason: body.reason.trim(),
      status: "PENDING",
    });

    await ActivityLog.create({
      userId,
      activityType: "LEAVE_REQUEST",
      date: formatDate(new Date()),
      timestamp: new Date(),
      description: `Requested ${days} day(s) of ${type} leave.`,
      metadata: { leaveId: newRequest._id, leaveType: type, days, status: "PENDING" },
    });

    return NextResponse.json(
      { message: "Leave request submitted.", newRequest: { id: String(newRequest._id), days } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Employee leaves POST error:", error);
    return NextResponse.json({ error: "Failed to submit leave request." }, { status: 500 });
  }
}
