import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Leave from "@/modals/LeaveRequest";
import { DepartmentHead } from "@/modals/DepartmentHead";
import { getSessionUser } from "@/lib/auth";
import { canViewFullAuditLogs } from "@/lib/audit-log-access";
import { isDeskOpen } from "@/lib/desk-mode";
import { listFormattedLeaves, decideLeaveRequest, deleteLeaveRequest } from "@/lib/leave-service";

export const dynamic = "force-dynamic";

async function requireReviewer() {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role === "admin") return user;
  if (canViewFullAuditLogs(user.email) && (await isDeskOpen())) return user;
  return null;
}

/** Department head leaves. Admin and the restricted reviewer can open this list. */
export async function GET() {
  try {
    const user = await requireReviewer();
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
    const user = await requireReviewer();
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

    const result = await decideLeaveRequest(id, action, "by Admin");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ id: result.id, status: result.status });
  } catch (error) {
    console.error("PUT head-leaves error:", error);
    return NextResponse.json({ error: "Failed to update leave request status." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireReviewer();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "Missing leave id." }, { status: 400 });
    }

    await dbConnect();
    const leave = await Leave.findById(id).select("userId status").lean<{ userId?: string; status?: string } | null>();
    if (!leave) {
      return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
    }

    const status = String(leave.status || "").toUpperCase();
    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json({ error: "Only an accepted or rejected leave can be deleted." }, { status: 400 });
    }

    const isDepartmentHead = await DepartmentHead.exists({ userId: leave.userId });
    if (!isDepartmentHead) {
      return NextResponse.json({ error: "Only a department head's leave can be deleted here." }, { status: 403 });
    }

    const result = await deleteLeaveRequest(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ id: result.id, refundedDays: result.refundedDays });
  } catch (error) {
    console.error("DELETE head-leaves error:", error);
    return NextResponse.json({ error: "Failed to delete leave request." }, { status: 500 });
  }
}
