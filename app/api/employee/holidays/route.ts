import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { Holiday } from "@/modals/Holiday";
import { getKarachiDateString } from "@/lib/attendance-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const today = getKarachiDateString();
    const holidays = await Holiday.find({ endDate: { $gte: today } })
      .sort({ startDate: 1 })
      .select("title startDate endDate resumeDate announcement")
      .lean();
    return NextResponse.json({ holidays });
  } catch (error) {
    console.error("Employee holidays error:", error);
    return NextResponse.json({ error: "Failed to load holidays" }, { status: 500 });
  }
}
