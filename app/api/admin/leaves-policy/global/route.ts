import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { GlobalLeavePolicy } from "@/modals/GlobalLeavePolicy";
import LeaveBalance from "@/modals/LeaveBalance";
import { resetLeaveBalancesForNewYear } from "@/lib/leave-proration";
import { getKarachiDateParts } from "@/lib/birthday-date";

const defaults = { ANNUAL: 15, SICK: 8, CASUAL: 6 };
type GlobalPolicyShape = typeof defaults & { year: number };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return String(session?.user?.role || "").toLowerCase() === "admin";
}

async function getOrCreatePolicy() {
  const policy = (await GlobalLeavePolicy.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default", year: getKarachiDateParts().year, ...defaults } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()) as unknown as GlobalPolicyShape;
  const currentYear = getKarachiDateParts().year; // Asia/Karachi year — aligned with midnight leave-reset cron
  if (policy.year < currentYear) {
    await resetLeaveBalancesForNewYear(currentYear, policy);
  }
  if (policy.year !== currentYear) {
    return GlobalLeavePolicy.findOneAndUpdate(
      { key: "default" },
      { $set: { year: currentYear } },
      { new: true }
    ).lean();
  }
  return policy;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access Denied: Admin role required." }, { status: 403 });
  }
  try {
    await connectDB();
    const policy = await getOrCreatePolicy();
    return NextResponse.json({ policy });
  } catch (error) {
    console.error("Global leave policy GET error:", error);
    return NextResponse.json({ error: "Failed to load global leave policy." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access Denied: Admin role required." }, { status: 403 });
  }
  try {
    await connectDB();
    const body = await request.json();
    const values = Object.fromEntries(
      ["ANNUAL", "SICK", "CASUAL"].map((key) => [key, Number(body[key])])
    );
    if (Object.values(values).some((value) => !Number.isInteger(value) || value < 0)) {
      return NextResponse.json({ error: "Leave values must be non-negative integers." }, { status: 400 });
    }

    const policy = await GlobalLeavePolicy.findOneAndUpdate(
      { key: "default" },
      { $set: { ...values, year: getKarachiDateParts().year } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    await LeaveBalance.updateMany(
      { customPolicy: { $ne: true } },
      {
        $set: {
          "ANNUAL.allocated": values.ANNUAL,
          "SICK.allocated": values.SICK,
          "CASUAL.allocated": values.CASUAL,
        },
      }
    );
    return NextResponse.json({ policy });
  } catch (error) {
    console.error("Global leave policy POST error:", error);
    return NextResponse.json({ error: "Failed to save global leave policy." }, { status: 500 });
  }
}
