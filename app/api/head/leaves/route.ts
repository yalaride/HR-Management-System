import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Leave from "@/modals/LeaveRequest";
import { DepartmentHead } from "@/modals/DepartmentHead";
import { getDepartmentHeadContext, getDepartmentMemberUserIds } from "@/lib/department-head";
import { listFormattedLeaves, decideLeaveRequest } from "@/lib/leave-service";

async function departmentHeadUserIds(): Promise<Set<string>> {
  const heads = await DepartmentHead.find().select("userId").lean<{ userId?: { toString(): string } }[]>();
  return new Set(heads.map((head) => (head.userId ? String(head.userId) : "")).filter(Boolean));
}

export const dynamic = "force-dynamic";

// GET: leaves of the head's department members (the head's own leaves are
// excluded — those are decided by the admin, never by the head themselves).
export async function GET() {
  try {
    const ctx = await getDepartmentHeadContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Forbidden: Department head access required." },
        { status: 403 }
      );
    }

    const [memberIds, headIds] = await Promise.all([
      getDepartmentMemberUserIds(ctx.department, ctx.user.id),
      departmentHeadUserIds(),
    ]);
    const leaves = await listFormattedLeaves(memberIds.filter((id) => !headIds.has(id)));

    return NextResponse.json({ department: ctx.department, leaves });
  } catch (error) {
    console.error("GET head leaves error:", error);
    return NextResponse.json({ error: "Failed to load department leaves." }, { status: 500 });
  }
}

// PUT: approve / reject a department member's leave — body: { id, action }
export async function PUT(req: Request) {
  try {
    const ctx = await getDepartmentHeadContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Forbidden: Department head access required." },
        { status: 403 }
      );
    }

    const { id, action } = (await req.json().catch(() => ({}))) as {
      id?: string;
      action?: string;
    };

    if (!id || !action) {
      return NextResponse.json({ error: "Missing action requirements." }, { status: 400 });
    }

    await dbConnect();
    const leave = await Leave.findById(id).select("userId").lean<{ userId?: unknown } | null>();
    if (!leave) {
      return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
    }

    const leaveUserId = String(leave.userId || "");
    const headIds = await departmentHeadUserIds();
    if (leaveUserId === ctx.user.id || headIds.has(leaveUserId)) {
      return NextResponse.json(
        { error: "A department head's leave can only be accepted or rejected by admin or Ubaid." },
        { status: 403 }
      );
    }

    // The target must be an active member of the head's department
    const memberIds = await getDepartmentMemberUserIds(ctx.department, ctx.user.id);
    if (!memberIds.includes(leaveUserId)) {
      return NextResponse.json(
        { error: "This leave request is outside your department." },
        { status: 403 }
      );
    }

    const result = await decideLeaveRequest(
      id,
      action,
      `by department head ${ctx.user.name || ""}`.trim()
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ id: result.id, status: result.status });
  } catch (error) {
    console.error("PUT head leaves error:", error);
    return NextResponse.json({ error: "Failed to update leave request status." }, { status: 500 });
  }
}
