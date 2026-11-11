import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import EmployeeLeavePolicy from "@/modals/LeavePolicy";
import LeaveBalance from "@/modals/LeaveBalance";
import { Employee } from "@/modals/Employee"; // Named export
import User from "@/modals/User"; // Default export
import { GlobalLeavePolicy } from "@/modals/GlobalLeavePolicy";

// Shape of a lean Employee doc with the populated userId sub-document
interface PolicyEmployee {
  name?: string;
  designation?: string;
  role?: string;
  profilePhotoUrl?: string;
  profilePhotoURL?: string;
  profilePicture?: string;
  image?: string;
  picture?: string;
  // May be a populated User sub-document or a raw ObjectId (when not populated)
  userId?: {
    email?: string;
    profilePhotoUrl?: string;
    profilePhotoURL?: string;
    profilePicture?: string;
    image?: string;
    picture?: string;
    toString(): string;
  } | null;
}

interface GlobalPolicyValues {
  ANNUAL?: number;
  SICK?: number;
  CASUAL?: number;
}

// Shape of a populated userId reference once the "_id" presence check has passed
type PopulatedUserRef = { _id: { toString(): string } };

// GET: Fetch ONLY active employees with their custom policy status and values
export async function GET() {
  try {
    await connectDB();

    // Next.js hot-reload fix: Force reference User model so Mongoose registers the schema 
    // before the "populate" query runs on the Employee collection.
    void User.modelName;

    const session = await getServerSession(authOptions);
    const role = String(session?.user?.role ?? "").toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Access Denied: Admin role required." }, { status: 403 });
    }

    // Safer, index-friendly status check. Does not crash if status is missing or null.
    const activeEmployees = (await Employee.find({ 
      status: { $in: ["Active", "active", "ACTIVE"] }
    }).populate({
      path: "userId",
      select: "email"
    }).lean()) as unknown as PolicyEmployee[];

    // Map active user IDs as string keys
    const activeUserIds = activeEmployees.map((emp) => {
      if (emp.userId && typeof emp.userId === "object" && "_id" in emp.userId) {
        return (emp.userId as PopulatedUserRef)._id.toString();
      }
      return emp.userId?.toString();
    }).filter(Boolean);

    // Fetch active leave balances for these user IDs
    const globalPolicy = (await GlobalLeavePolicy.findOne({ key: "default" }).lean()) as unknown as
      | GlobalPolicyValues
      | null;
    const defaults = {
      ANNUAL: globalPolicy?.ANNUAL ?? 15,
      SICK: globalPolicy?.SICK ?? 8,
      CASUAL: globalPolicy?.CASUAL ?? 6,
    };
    const leaveBalances = await LeaveBalance.find({
      userId: { $in: activeUserIds }
    }).lean();

    const employeesList = activeEmployees.map((emp) => {
      const userIdStr = emp.userId && typeof emp.userId === "object" && "_id" in emp.userId
        ? (emp.userId as PopulatedUserRef)._id.toString()
        : emp.userId?.toString() || "";

      const emailStr = emp.userId && typeof emp.userId === "object" && "email" in emp.userId
        ? emp.userId.email
        : "";

      const balance = leaveBalances.find((b) => b.userId === userIdStr);
      const isCustom = balance ? !!balance.customPolicy : false;

      // Profile fields may live either on Employee or User docs depending on your schema.
      const profilePhotoUrl =
        emp.profilePhotoUrl ||
        emp.profilePhotoURL ||
        emp.profilePicture ||
        emp.image ||
        emp.picture ||
        emp.userId?.profilePhotoUrl ||
        emp.userId?.profilePhotoURL ||
        emp.userId?.profilePicture ||
        emp.userId?.image ||
        emp.userId?.picture ||
        "";

      const designation = emp.designation || emp.role || "";

      return {
        userId: userIdStr,
        name: emp.name || "Unnamed Employee",
        email: emailStr || "No Registered Email",
        isCustom,
        designation,
        profilePhotoUrl,
        policy: {
          // Using optional chaining (?.allocated) and fallback values (??)
          // to prevent crashes on legacy documents missing nested sub-objects.
          ANNUAL: balance?.ANNUAL?.allocated ?? defaults.ANNUAL,
          SICK: balance?.SICK?.allocated ?? defaults.SICK,
          CASUAL: balance?.CASUAL?.allocated ?? defaults.CASUAL,
        },
      };
    }).filter((emp) => emp.userId !== ""); // Filter out null userId objects safely


    return NextResponse.json(employeesList);
  } catch (error) {
    console.error("Employee leave policies fetch error:", error);
    return NextResponse.json({ 
      error: "Failed to load active employee list.", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
// POST: Set or update an employee's customized leave allowances & update balance allocations in sync
export async function POST() {
  return NextResponse.json(
    { error: "Monthly leave is fixed at 2 full days and 1 half day. It cannot be changed." },
    { status: 403 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Monthly leave is fixed at 2 full days and 1 half day. It cannot be changed." },
    { status: 403 }
  );
}
