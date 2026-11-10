import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Leave from "@/modals/LeaveRequest";
import { DepartmentHead } from "@/modals/DepartmentHead";
import { getSessionUser } from "@/lib/auth";
import { canViewFullAuditLogs } from "@/lib/audit-log-access";
import { listFormattedLeaves, decideLeaveRequest } from "@/lib/leave-service";

export const dynamic = "force-dynamic";

async function requireUbaid() {
  const user = await getSessionUser();
  if (!user || user.role === "admin" || !canViewFullAuditLogs(user.email)) return null;
  return user;
}

/** Leaves that belong to a department head. Only Ubaid decides these here; admin uses the admin leaves page. */
export async function GET() {
  try {
    const user = await requireUbaid();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const heads = await DepartmentHead.find()
      .select("userId department")
      .lean<{ userId?: { toString(): string }; department?: string }[]>();
    const departmentByUser = new Map(
      heads.map((head) => [head.userId ? String(head.userId) : "", head.department || ""])
    );
    const leaves = await listFormattedLeaves([...departmentByUser.keys()].filter(Boolean));

    return NextResponse.json({
      leaves: leaves.map((leave) => ({
        ...leave,
        department: departmentByUser.get(leave.userId) || "",
      })),
    });
  } catch (error) {
    console.error("GET head-leaves error:", error);
    return NextResponse.json({ error: "Failed to load department head leaves." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUbaid();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, action } = (await request.json().catch(() => ({}))) as {
      id?: string;
      action?: string;
    };
    if (!id || !action) {
      return NextResponse.json({ error: "Missing action requirements." }, { status: 400 });
    }

    await dbConnect();
    const leave = await Leave.findById(id).select("userId").lean<{ userId?: string } | null>();
    if (!leave) {
      return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
    }

    const isDepartmentHead = await DepartmentHead.exists({ userId: leave.userId });
    if (!isDepartmentHead) {
      return NextResponse.json(
        { error: "Only a department head's leave can be decided here." },
        { status: 403 }
      );
    }

    const result = await decideLeaveRequest(id, action, `by ${user.name || "Ubaid"}`);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ id: result.id, status: result.status });
  } catch (error) {
    console.error("PUT head-leaves error:", error);
    return NextResponse.json({ error: "Failed to update leave request status." }, { status: 500 });
  }
}
