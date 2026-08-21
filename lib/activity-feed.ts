import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { Employee } from "@/modals/Employee";
import { ActivityLog } from "@/modals/ActivityLog";

export interface ActivityFeedItem {
  _id: string;
  user: string;
  designation: string;
  action: string;
  type: string;
  createdAt: string;
}

export function mapActivityTypeToFrontendType(activityType: string): string {
  if (!activityType) return "system";
  const upper = activityType.toUpperCase();
  if (upper.includes("CHECK_IN") || upper.includes("CHECK_OUT") || upper.includes("ATTENDANCE")) {
    return "attendance";
  }
  if (
    upper.includes("LEAVE_REQUEST") ||
    upper.includes("LEAVE_APPROVED") ||
    upper.includes("LEAVE_REJECTED") ||
    upper.includes("LEAVE")
  ) {
    return "leave";
  }
  if (upper.includes("EMAIL_FAILED") || upper.includes("FAILED")) {
    return "error";
  }
  if (upper.includes("BIRTHDAY")) {
    return "birthday";
  }
  if (upper.includes("PAYSLIP") || upper.includes("SALARY") || upper.includes("PAYROLL")) {
    return "payslip";
  }
  return "system";
}

export async function listActivityFeed(options: {
  typeFilter?: string;
  searchQuery?: string;
  limit?: number;
}): Promise<ActivityFeedItem[]> {
  await connectDB();

  const typeFilter = options.typeFilter || "all";
  const searchQuery = options.searchQuery || "";
  const limit = options.limit ?? 100;

  let matchingUserIds: string[] = [];
  if (searchQuery) {
    const matchingEmployees = (await Employee.find({
      name: { $regex: searchQuery, $options: "i" },
    })
      .select("_id userId")
      .lean()) as unknown as Array<{
      _id: { toString(): string };
      userId?: { toString(): string };
    }>;

    matchingUserIds = matchingEmployees.flatMap((emp) => {
      const ids = [emp._id.toString()];
      if (emp.userId) ids.push(emp.userId.toString());
      return ids;
    });
  }

  const dbQuery: Record<string, unknown> = {};

  if (typeFilter !== "all") {
    if (typeFilter === "attendance") {
      dbQuery.activityType = { $in: ["CHECK_IN", "CHECK_OUT", "ATTENDANCE"] };
    } else if (typeFilter === "leave") {
      dbQuery.activityType = { $regex: "LEAVE", $options: "i" };
    } else if (typeFilter === "payslip") {
      dbQuery.activityType = { $regex: "PAYSLIP", $options: "i" };
    } else if (typeFilter === "birthday") {
      dbQuery.activityType = { $regex: "BIRTHDAY", $options: "i" };
    } else if (typeFilter === "error") {
      dbQuery.activityType = "EMAIL_FAILED";
    } else if (typeFilter === "system") {
      dbQuery.activityType = {
        $nin: ["CHECK_IN", "CHECK_OUT", "ATTENDANCE", "LEAVE_REQUEST", "LEAVE_APPROVED"],
      };
    }
  }

  if (searchQuery) {
    const orConditions: Record<string, unknown>[] = [
      { description: { $regex: searchQuery, $options: "i" } },
      { activityType: { $regex: searchQuery, $options: "i" } },
    ];
    if (matchingUserIds.length > 0) {
      orConditions.push({ userId: { $in: matchingUserIds } });
    }
    dbQuery.$or = orConditions;
  }

  const dbLogs = await ActivityLog.find(dbQuery).sort({ createdAt: -1 }).limit(limit).lean();

  interface LeanEmployee {
    _id?: { toString(): string };
    userId?: { toString(): string };
    name: string;
    designation: string;
  }

  const logUserIds = Array.from(
    new Set(
      (dbLogs as unknown as Array<{ userId?: string | { toString(): string } }>)
        .map((log) => log.userId?.toString() || "")
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );

  const employees =
    logUserIds.length > 0
      ? ((await Employee.find({
          $or: [{ _id: { $in: logUserIds } }, { userId: { $in: logUserIds } }],
        })
          .select("userId name designation")
          .lean()) as unknown as LeanEmployee[])
      : [];

  const employeeIdToName = new Map<string, string>();
  const employeeIdToDesignation = new Map<string, string>();
  const authUserIdToName = new Map<string, string>();
  const authUserIdToDesignation = new Map<string, string>();

  employees.forEach((emp) => {
    const empId = emp._id?.toString();
    const authUserId = emp.userId?.toString();
    if (empId) {
      employeeIdToName.set(empId, emp.name);
      employeeIdToDesignation.set(empId, emp.designation);
    }
    if (authUserId) {
      authUserIdToName.set(authUserId, emp.name);
      authUserIdToDesignation.set(authUserId, emp.designation);
    }
  });

  interface LeanActivityLog {
    _id: { toString(): string };
    userId?: string | { toString(): string };
    description?: string;
    activityType: string;
    createdAt?: string | Date;
  }

  const logsToRender = ((dbLogs || []) as unknown as LeanActivityLog[]).map((log) => {
    const userIdStr = log.userId?.toString();

    const resolvedName =
      (userIdStr ? employeeIdToName.get(userIdStr) : undefined) ??
      (userIdStr ? authUserIdToName.get(userIdStr) : undefined) ??
      "Unknown User";

    const resolvedDesignation =
      (userIdStr ? employeeIdToDesignation.get(userIdStr) : undefined) ??
      (userIdStr ? authUserIdToDesignation.get(userIdStr) : undefined) ??
      "";

    return {
      _id: log._id.toString(),
      user: resolvedName,
      designation: resolvedDesignation,
      action: log.description || "Performed an action",
      type: mapActivityTypeToFrontendType(log.activityType),
      createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  logsToRender.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return logsToRender;
}
