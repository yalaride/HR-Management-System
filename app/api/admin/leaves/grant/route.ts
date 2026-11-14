import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Leave from "@/modals/LeaveRequest";
import { Employee } from "@/modals/Employee";
import { ActivityLog } from "@/modals/ActivityLog";
import { getSessionUser } from "@/lib/auth";
import { canViewFullAuditLogs } from "@/lib/audit-log-access";
import { isDeskOpen } from "@/lib/desk-mode";
import { karachiToday, validateGrantedLeave, type QuotaLeave } from "@/lib/monthly-leave";

export const dynamic = "force-dynamic";

async function requireGranter() {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role === "admin") return user;
  if (canViewFullAuditLogs(user.email) && (await isDeskOpen())) return user;
  return null;
}

function isoDate(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const user = await requireGranter();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await dbConnect();
    const employees = await Employee.find({ status: { $nin: ["Inactive", "Terminated"] } })
      .select("userId name designation department")
      .sort({ name: 1 })
      .lean<{ userId?: { toString(): string }; name?: string; designation?: string; department?: string }[]>();
    return NextResponse.json({
      employees: employees.map((employee) => ({
        userId: employee.userId ? String(employee.userId) : "",
        name: employee.name || "",
        designation: employee.designation || "",
        department: employee.department || "",
      })).filter((employee) => employee.userId),
    });
  } catch (error) {
    console.error("GET grant leave error:", error);
    return NextResponse.json({ error: "Failed to load employees." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireGranter();
    if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      userId?: string;
      kind?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    };
    const kind = String(body.kind || "").toUpperCase();
    if (!body.userId || !["URGENT", "EXTRA_PAID"].includes(kind) || !body.startDate || !body.endDate || !body.reason?.trim()) {
      return NextResponse.json({ error: "Choose an employee, urgent or extra paid leave, the dates, and a reason." }, { status: 400 });
    }

    await dbConnect();
    const employee = await Employee.findOne({ userId: body.userId }).select("name designation").lean<{ name?: string; designation?: string } | null>();
    if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const existingLeaves = await Leave.find({ userId: body.userId }).select("type status startDate endDate").lean();
    const existing: QuotaLeave[] = existingLeaves.map((leave) => ({
      type: String(leave.type || ""),
      status: String(leave.status || ""),
      startDate: isoDate(leave.startDate),
      endDate: isoDate(leave.endDate),
    }));
    const checked = validateGrantedLeave({
      kind: kind as "URGENT" | "EXTRA_PAID",
      start: body.startDate,
      end: body.endDate,
      today: karachiToday(),
      existing,
    });
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

    const start = new Date(`${body.startDate}T00:00:00.000Z`);
    const endExclusive = new Date(`${body.endDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const overlap = await Leave.findOne({
      userId: body.userId,
      status: { $in: ["PENDING", "APPROVED"] },
      startDate: { $lt: endExclusive },
      endDate: { $gte: start },
    }).lean();
    if (overlap) {
      return NextResponse.json({ error: "One of these days is already in another leave." }, { status: 409 });
    }

    const created = await Leave.create({
      userId: body.userId,
      employeeName: employee.name || "Employee",
      designation: employee.designation || "",
      type: kind,
      startDate: start,
      endDate: new Date(`${body.endDate}T00:00:00.000Z`),
      days: checked.days,
      reason: body.reason.trim(),
      status: "APPROVED",
    });

    await ActivityLog.create({
      userId: body.userId,
      activityType: "LEAVE_APPROVED",
      date: karachiToday(),
      timestamp: new Date(),
      description: `${checked.days} day(s) of ${kind === "URGENT" ? "urgent" : "extra paid"} leave was set by Admin.`,
      metadata: { leaveId: created._id, leaveType: kind, days: checked.days, status: "APPROVED" },
    });

    return NextResponse.json({ id: String(created._id), days: checked.days }, { status: 201 });
  } catch (error) {
    console.error("POST grant leave error:", error);
    return NextResponse.json({ error: "Failed to set the leave." }, { status: 500 });
  }
}
