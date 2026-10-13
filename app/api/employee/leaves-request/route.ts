"use server";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import connectDB from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import Leave from "@/modals/LeaveRequest";
import LeaveBalance from "@/modals/LeaveBalance";
import { Employee } from "@/modals/Employee";
import { ActivityLog } from "@/modals/ActivityLog";
import { GlobalLeavePolicy } from "@/modals/GlobalLeavePolicy";
import {
  applyEmployeeLeaveProration,
  DEFAULT_LEAVE_POLICY,
  resetLeaveBalancesForNewYear,
} from "@/lib/leave-proration";
import { getKarachiDateParts } from "@/lib/birthday-date";

type TrackedLeaveType = "ANNUAL" | "SICK" | "CASUAL";
type LeaveRequestType = TrackedLeaveType | "UNPAID";

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

interface PolicyValues {
  year: number;
  ANNUAL: number;
  SICK: number;
  CASUAL: number;
}

function formatDate(value: unknown): string {
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
}

async function getActivePolicy(): Promise<PolicyValues> {
  const currentYear = getKarachiDateParts().year; // Asia/Karachi year — aligned with midnight leave-reset cron
  let policy = (await GlobalLeavePolicy.findOneAndUpdate(
    { key: "default" },
    {
      $setOnInsert: {
        key: "default",
        year: currentYear,
        ...DEFAULT_LEAVE_POLICY,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()) as unknown as PolicyValues;

  if (policy.year < currentYear) {
    await resetLeaveBalancesForNewYear(currentYear, policy);
    policy = (await GlobalLeavePolicy.findOneAndUpdate(
      { key: "default" },
      { $set: { year: currentYear } },
      { new: true }
    ).lean()) as unknown as PolicyValues;
  }

  return {
    year: currentYear,
    ANNUAL: Number(policy.ANNUAL ?? DEFAULT_LEAVE_POLICY.ANNUAL),
    SICK: Number(policy.SICK ?? DEFAULT_LEAVE_POLICY.SICK),
    CASUAL: Number(policy.CASUAL ?? DEFAULT_LEAVE_POLICY.CASUAL),
  };
}

async function getEmployee(userId: string): Promise<EmployeeInfo | null> {
  return Employee.findOne({ userId })
    .select("name designation employmentType confirmationDate joinDate")
    .lean<EmployeeInfo>();
}

async function getOrCreateBalance(
  userId: string,
  employee: EmployeeInfo,
  policy: PolicyValues
) {
  if (employee.joinDate) {
    await applyEmployeeLeaveProration(userId, new Date(employee.joinDate));
  }
  const balance = await LeaveBalance.findOne({ userId });
  if (balance) return balance;
  return LeaveBalance.create({
    userId,
    ANNUAL: { allocated: policy.ANNUAL, used: 0, remaining: policy.ANNUAL },
    SICK: { allocated: policy.SICK, used: 0, remaining: policy.SICK },
    CASUAL: { allocated: policy.CASUAL, used: 0, remaining: policy.CASUAL },
  });
}

function serializeBalances(balance: Awaited<ReturnType<typeof getOrCreateBalance>>, visible: boolean) {
  const types = ["ANNUAL", "SICK", "CASUAL"] as const;
  return Object.fromEntries(
    types.map((type) => {
      const allocated = visible ? Number(balance[type]?.allocated ?? 0) : 0;
      const used = visible ? Number(balance[type]?.used ?? 0) : 0;
      return [
        type,
        {
          allocated,
          used,
          remaining: Math.max(0, allocated - used),
        },
      ];
    })
  ) as Record<TrackedLeaveType, { allocated: number; used: number; remaining: number }>;
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
    const policy = await getActivePolicy();
    const balance = await getOrCreateBalance(userId, employee || {}, policy);
    const balances = serializeBalances(balance, true);

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

    return NextResponse.json({
      leaves: formattedLeaves,
      balances,
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
      type?: LeaveRequestType;
      startDate?: string;
      endDate?: string;
      reason?: string;
    };
    const type = String(body.type || "").toUpperCase() as LeaveRequestType;
    if (!["ANNUAL", "SICK", "CASUAL", "UNPAID"].includes(type) || !body.startDate || !body.endDate || !body.reason?.trim()) {
      return NextResponse.json({ error: "Missing or invalid leave request fields." }, { status: 400 });
    }

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
    }

    // Compare calendar days rather than exact timestamps so same-day requests
    // are blocked even when existing records contain a different time value.
    const startDay = new Date(`${body.startDate}T00:00:00.000Z`);
    const endDayExclusive = new Date(`${body.endDate}T00:00:00.000Z`);
    endDayExclusive.setUTCDate(endDayExclusive.getUTCDate() + 1);

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const startDate = body.startDate;
    if (startDate < today) {
      return NextResponse.json({ error: "Leave start date cannot be in the past." }, { status: 400 });
    }

    if (["ANNUAL", "CASUAL"].includes(type)) {
      const [year, month, day] = today.split("-").map(Number);
      const earliest = new Date(Date.UTC(year, month - 1, day + 2)).toISOString().split("T")[0];
      if (startDate < earliest) {
        return NextResponse.json(
          { error: `${type === "ANNUAL" ? "Annual" : "Casual"} leave must be requested at least 2 days in advance.` },
          { status: 400 }
        );
      }
    }

    // Prevent double-booking: an employee must not have a second leave
    // request covering any of the same days. Only REJECTED requests are
    // ignored — PENDING and APPROVED both occupy the requested days.
    const overlappingLeave = await Leave.findOne({
      userId,
      status: { $in: ["PENDING", "APPROVED"] },
      startDate: { $lt: endDayExclusive },
      endDate: { $gte: startDay },
    }).lean();

    if (overlappingLeave) {
      return NextResponse.json(
        {
          error:
            "You already have a leave request that covers one or more of these days. " +
            "Each day can only be included in a single leave request.",
        },
        { status: 409 }
      );
    }

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    const policy = await getActivePolicy();
    const balance = await getOrCreateBalance(userId, employee || {}, policy);

    if (type !== "UNPAID") {
      const entry = balance[type];
      const allocated = Number(entry.allocated || 0);
      const used = Number(entry.used || 0);
      const remaining = Math.max(0, allocated - used);
      if (remaining < days) {
        return NextResponse.json(
          { error: `Insufficient ${type.toLowerCase()} leave balance. Remaining: ${remaining}.` },
          { status: 400 }
        );
      }

      entry.used = used + days;
      entry.remaining = remaining - days;
      balance.markModified(type);
      await balance.save();
    }

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
