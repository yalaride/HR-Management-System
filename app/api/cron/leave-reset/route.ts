import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { GlobalLeavePolicy } from "@/modals/GlobalLeavePolicy";
import { resetLeaveBalancesForNewYear } from "@/lib/leave-proration";
import { getKarachiDateParts } from "@/lib/birthday-date";

export const dynamic = "force-dynamic";

const DEFAULTS = { ANNUAL: 15, SICK: 8, CASUAL: 6 };

/**
 * Year-rollover cron (midnight Asia/Karachi).
 * Runs daily; when the Karachi calendar year moves past the stored policy year,
 * resets every employee's leave balances (used -> 0, allocations refreshed,
 * prorated annual allowances restored) and stamps the policy with the new year.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();

    // CRON_SECRET is mandatory — without it this endpoint stays locked.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger." }, { status: 401 });
    }

    await connectDB();

    const local = getKarachiDateParts(); // authoritative year for leave reset
    const currentYear = local.year;

    const policy = (await GlobalLeavePolicy.findOneAndUpdate(
      { key: "default" },
      { $setOnInsert: { key: "default", year: currentYear, ...DEFAULTS } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()) as unknown as { year: number; ANNUAL: number; SICK: number; CASUAL: number };

    if (policy.year >= currentYear) {
      return NextResponse.json({
        resetPerformed: false,
        year: policy.year,
        date: local.dateStr,
        message: `No reset needed. Leave policy year is already ${policy.year}.`,
      });
    }

    await resetLeaveBalancesForNewYear(currentYear, policy);

    const updatedPolicy = await GlobalLeavePolicy.findOneAndUpdate(
      { key: "default" },
      { $set: { year: currentYear } },
      { new: true }
    ).lean();

    return NextResponse.json({
      resetPerformed: true,
      previousYear: policy.year,
      currentYear,
      date: local.dateStr,
      message: `Leave balances reset: ${policy.year} → ${currentYear} (Asia/Karachi).`,
      policy: updatedPolicy,
    });
  } catch (error) {
    console.error("Cron Leave Reset Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}