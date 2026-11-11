/**
 * Shared leave listing + decision logic used by both the admin panel
 * (/api/admin/leaves) and department heads (/api/head/leaves).
 */
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Leave from "@/modals/LeaveRequest";
import LeaveBalance from "@/modals/LeaveBalance";
import { Employee } from "@/modals/Employee";
import { ActivityLog } from "@/modals/ActivityLog";
import { MONTHLY_FULL_DAYS, MONTHLY_HALF_DAYS, monthKey, monthUsage, type QuotaLeave } from "@/lib/monthly-leave";

type TrackedLeaveType = "ANNUAL" | "SICK" | "CASUAL";

type LeaveBalanceEntry = { allocated?: number; used?: number; remaining?: number };
type LeanLeaveBalance = Partial<Record<TrackedLeaveType, LeaveBalanceEntry>>;

interface LeanLeave {
  _id: unknown;
  userId?: string | mongoose.Types.ObjectId;
  type?: string;
  status?: string;
  startDate?: unknown;
  endDate?: unknown;
  days?: number;
  reason?: string;
  employeeName?: string;
  designation?: string;
}

interface LeanEmployeeInfo {
  name?: string;
  designation?: string;
  profilePhotoUrl?: string;
  profilePhotoURL?: string;
  profilePicture?: string;
  image?: string;
  picture?: string;
}

export interface FormattedLeave {
  id: string;
  userId: string;
  employeeName: string;
  profilePhotoUrl: string;
  designation: string;
  type: string;
  typeUpper: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  statusUpper: string;
  totalLeaves: number;
  usedLeaves: number;
  remainingLeaves: number;
  monthLabel?: string;
  fullUsed?: number;
  fullRemaining?: number;
  halfUsed?: number;
  halfRemaining?: number;
}

function formatDateString(value: unknown): string {
  if (!value) return "";
  try {
    const d = new Date(value as string | number | Date);
    if (isNaN(d.getTime())) {
      return String(value).split("T")[0] || "";
    }
    return d.toISOString().split("T")[0];
  } catch {
    return String(value).split("T")[0] || "";
  }
}

/**
 * Lists leaves with employee info + live balance metrics.
 * Pass userIds to scope results (department-head view); omit for all (admin).
 *
 * Uses 3 batched queries total (leaves, employees, balances) instead of
 * 2 queries per leave — critical for admin panel load time.
 */
export async function listFormattedLeaves(userIds?: string[]): Promise<FormattedLeave[]> {
  await dbConnect();

  const query: Record<string, unknown> = {
    // Support both lowercase and uppercase legacy status values
    status: {
      $in: [
        "PENDING", "APPROVED", "REJECTED",
        "pending", "approved", "rejected",
        "Pending", "Approved", "Rejected",
      ],
    },
  };

  if (userIds) {
    if (userIds.length === 0) return [];
    query.userId = { $in: userIds };
  }

  const leaves = (await Leave.find(query)
    .sort({ createdAt: -1 })
    .lean()) as unknown as LeanLeave[];

  if (leaves.length === 0) return [];

  // Batch-load employees and balances for all distinct leave owners at once
  const distinctUserIds = Array.from(new Set(leaves.map((l) => String(l.userId || "")))).filter(
    Boolean
  );
  const objectIdUserIds = distinctUserIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [employeeDocs, balanceDocs] = await Promise.all([
    Employee.find({ userId: { $in: objectIdUserIds } })
      .select("userId name designation profilePhotoUrl profilePhotoURL profilePicture image picture")
      .lean<(LeanEmployeeInfo & { userId?: { toString(): string } })[]>(),
    LeaveBalance.find({ userId: { $in: distinctUserIds } }).lean<
      (LeanLeaveBalance & { userId?: string })[]
    >(),
  ]);

  const employeeByUserId = new Map(
    employeeDocs.map((doc) => [doc.userId ? doc.userId.toString() : "", doc])
  );
  const balanceByUserId = new Map(balanceDocs.map((doc) => [String(doc.userId || ""), doc]));

  const quotaByUser = new Map<string, QuotaLeave[]>();
  for (const leave of leaves) {
    const id = String(leave.userId || "");
    const entry: QuotaLeave = {
      type: String(leave.type || ""),
      status: String(leave.status || ""),
      startDate: formatDateString(leave.startDate),
      endDate: formatDateString(leave.endDate),
    };
    quotaByUser.set(id, [...(quotaByUser.get(id) || []), entry]);
  }

  return leaves.map((leave) => {
    const leaveUserId = String(leave.userId || "");
    const employeeDoc: LeanEmployeeInfo | null = employeeByUserId.get(leaveUserId) || null;
    const balance: LeanLeaveBalance | null = balanceByUserId.get(leaveUserId) || null;

    const rawType = String(leave.type || "").toUpperCase();
    const rawStatus = String(leave.status || "PENDING").toUpperCase();

    const isAnnual = rawType.includes("ANNUAL");
    const isSick = rawType.includes("SICK");
    const isCasual = rawType.includes("CASUAL");
    const isUnpaid = rawType.includes("UNPAID");
    const isMonthly = rawType === "FULL" || rawType === "HALF" || rawType === "URGENT" || rawType === "EXTRA_PAID";
    const startDate = formatDateString(leave.startDate);
    const endDate = formatDateString(leave.endDate);
    const usage = isMonthly ? monthUsage(quotaByUser.get(leaveUserId) || [], monthKey(startDate)) : null;

    let totalLeaves = 0;
    let usedLeaves = 0;
    let remainingLeaves = 0;

    let matchedKey: TrackedLeaveType | null = null;
    if (isAnnual) matchedKey = "ANNUAL";
    else if (isSick) matchedKey = "SICK";
    else if (isCasual) matchedKey = "CASUAL";

    const trackedBalance = matchedKey && balance ? balance[matchedKey] : undefined;
    if (rawType === "HALF") {
      totalLeaves = MONTHLY_HALF_DAYS;
      usedLeaves = usage?.half || 0;
      remainingLeaves = Math.max(0, totalLeaves - usedLeaves);
    } else if (rawType === "FULL" || rawType === "URGENT") {
      totalLeaves = MONTHLY_FULL_DAYS;
      usedLeaves = usage?.full || 0;
      remainingLeaves = Math.max(0, totalLeaves - usedLeaves);
    } else if (trackedBalance) {
      totalLeaves = Number(trackedBalance.allocated ?? 15);
      usedLeaves = Number(trackedBalance.used ?? 0);
      remainingLeaves = Math.max(0, totalLeaves - usedLeaves);
    }

    const typeTitle = isAnnual
      ? "Annual Leave"
      : isSick
        ? "Sick Leave"
        : isCasual
          ? "Casual Leave"
          : isUnpaid
            ? "Unpaid Leave"
            : rawType === "FULL"
              ? "Full day"
              : rawType === "HALF"
                ? "Half day"
                : rawType === "URGENT"
                  ? "Urgent leave"
                  : rawType === "EXTRA_PAID"
                    ? "Extra paid leave"
                    : leave.type || "Other Leave";

    const statusTitle =
      rawStatus === "APPROVED" ? "Approved" : rawStatus === "REJECTED" ? "Rejected" : "Pending";

    const resolvedName = employeeDoc?.name || leave.employeeName || "Employee";
    const resolvedDesignation = employeeDoc?.designation || leave.designation || "Staff Member";
    const resolvedProfilePhotoUrl =
      employeeDoc?.profilePhotoUrl ||
      employeeDoc?.profilePhotoURL ||
      employeeDoc?.profilePicture ||
      employeeDoc?.image ||
      employeeDoc?.picture ||
      "";

    return {
      id: String(leave._id),
      userId: leaveUserId,
      employeeName: resolvedName,
      profilePhotoUrl: resolvedProfilePhotoUrl,
      designation: resolvedDesignation,
      type: typeTitle,
      typeUpper: matchedKey || rawType,
      startDate: formatDateString(leave.startDate),
      endDate: formatDateString(leave.endDate),
      days: Number(leave.days || 0),
      reason: leave.reason || "No reason provided",
      status: statusTitle,
      statusUpper: rawStatus,
      totalLeaves,
      usedLeaves,
      remainingLeaves,
      monthLabel: new Date(`${monthKey(startDate)}-01T00:00:00.000Z`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      fullUsed: usage?.full,
      fullRemaining: usage ? Math.max(0, MONTHLY_FULL_DAYS - usage.full) : undefined,
      halfUsed: usage?.half,
      halfRemaining: usage ? Math.max(0, MONTHLY_HALF_DAYS - usage.half) : undefined,
    };
  });
}

export type LeaveDecisionResult =
  | { ok: true; id: string; status: "Approved" | "Rejected" }
  | { ok: false; status: number; error: string };

export type LeaveDeleteResult =
  | { ok: true; id: string; refundedDays: number }
  | { ok: false; status: number; error: string };

/**
 * Permanently deletes a leave request and refunds the employee's balance.
 * Used by admins to remove test/mistaken leaves so the used-days count is
 * restored (e.g. an approved leave the employee never actually took).
 *
 * Refund rules mirror the reject flow: REJECTED leaves were already refunded
 * and UNPAID leaves never consume tracked balance, so neither refunds again.
 */
export async function deleteLeaveRequest(id: string): Promise<LeaveDeleteResult> {
  await dbConnect();

  if (!id) {
    return { ok: false, status: 400, error: "Missing leave id." };
  }

  const leaveRequest = await Leave.findById(id);
  if (!leaveRequest) {
    return { ok: false, status: 404, error: "Leave request not found." };
  }

  const currentStatus = String(leaveRequest.status).toUpperCase();
  const leaveType = String(leaveRequest.type).toUpperCase();
  const days = Number(leaveRequest.days || 0);
  let refundedDays = 0;
  const legacyType = leaveType === "ANNUAL" || leaveType === "SICK" || leaveType === "CASUAL";

  if (legacyType && currentStatus !== "REJECTED") {
    const balanceDoc = await LeaveBalance.findOne({ userId: leaveRequest.userId });
    const balance = balanceDoc as LeanLeaveBalance | null;

    const matchedKey: TrackedLeaveType = leaveType.includes("ANNUAL")
      ? "ANNUAL"
      : leaveType.includes("SICK")
        ? "SICK"
        : "CASUAL";

    const balanceEntry = balance ? balance[matchedKey] : undefined;
    if (balanceEntry && balanceDoc) {
      const currentUsed = Number(balanceEntry.used || 0);
      balanceEntry.used = Math.max(0, currentUsed - days);
      refundedDays = currentUsed - Number(balanceEntry.used);

      const allocated = Number(balanceEntry.allocated ?? 0);
      balanceEntry.remaining = Math.max(0, allocated - balanceEntry.used);

      balanceDoc.markModified(matchedKey);
      await balanceDoc.save();
    }
  }

  await Leave.findByIdAndDelete(id);

  await ActivityLog.create({
    userId: leaveRequest.userId,
    activityType: "LEAVE_DELETED",
    date: formatDateString(new Date()),
    timestamp: new Date(),
    description: `Leave request for ${days} day(s) of ${leaveRequest.type} was deleted by admin${
      refundedDays > 0 ? ` (${refundedDays} day(s) restored to balance)` : ""
    }.`,
  });

  return { ok: true, id: String(leaveRequest._id), refundedDays };
}

/**
 * Approves or rejects a leave request (includes balance refund on reject).
 * decidedByNote is appended to the activity log, e.g. "by department head Ali".
 */
export async function decideLeaveRequest(
  id: string,
  action: string,
  decidedByNote = ""
): Promise<LeaveDecisionResult> {
  await dbConnect();

  if (!id || !action) {
    return { ok: false, status: 400, error: "Missing action requirements." };
  }

  const targetAction = String(action).toUpperCase();
  const leaveRequest = await Leave.findById(id);

  if (!leaveRequest) {
    return { ok: false, status: 404, error: "Leave request not found." };
  }

  const currentStatus = String(leaveRequest.status).toUpperCase();
  const leaveType = String(leaveRequest.type).toUpperCase();
  const noteSuffix = decidedByNote ? ` ${decidedByNote}` : "";

  if (targetAction === "APPROVE") {
    leaveRequest.status = "APPROVED";
    await leaveRequest.save();

    await ActivityLog.create({
      userId: leaveRequest.userId,
      activityType: "LEAVE_APPROVED",
      date: formatDateString(new Date()),
      timestamp: new Date(),
      description: `Leave request for ${leaveRequest.days} day(s) of ${leaveRequest.type} was Approved${noteSuffix}.`,
    });
  } else if (targetAction === "REJECT") {
    // Prevents "UNPAID" leaves (or variations like "UNPAID LEAVE") from corrupting and refunding casual leaves
    if (leaveType === "ANNUAL" || leaveType === "SICK" || leaveType === "CASUAL") {
    if (currentStatus !== "REJECTED" && !leaveType.includes("UNPAID")) {
      const balanceDoc = await LeaveBalance.findOne({ userId: leaveRequest.userId });
      const balance = balanceDoc as LeanLeaveBalance | null;

      const matchedKey: TrackedLeaveType = leaveType.includes("ANNUAL")
        ? "ANNUAL"
        : leaveType.includes("SICK")
          ? "SICK"
          : "CASUAL";

      const balanceEntry = balance ? balance[matchedKey] : undefined;
      if (balanceEntry && balanceDoc) {
        const currentUsed = Number(balanceEntry.used || 0);
        balanceEntry.used = Math.max(0, currentUsed - Number(leaveRequest.days || 0));

        const allocated = Number(balanceEntry.allocated ?? 0);
        balanceEntry.remaining = Math.max(0, allocated - balanceEntry.used);

        balanceDoc.markModified(matchedKey);
        await balanceDoc.save();
      }
    }
    }
    leaveRequest.status = "REJECTED";
    await leaveRequest.save();

    await ActivityLog.create({
      userId: leaveRequest.userId,
      activityType: "LEAVE_REJECTED",
      date: formatDateString(new Date()),
      timestamp: new Date(),
      description: `Leave request for ${leaveRequest.days} day(s) of ${leaveRequest.type} was Rejected${noteSuffix}.`,
    });
  } else {
    return { ok: false, status: 400, error: "Invalid action." };
  }

  return {
    ok: true,
    id: String(leaveRequest._id),
    status: leaveRequest.status === "APPROVED" ? "Approved" : "Rejected",
  };
}
