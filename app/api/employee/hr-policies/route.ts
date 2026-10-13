import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { HRPolicy, defaultHRPolicySections } from "@/modals/HRPolicy";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (String(session?.user?.role || "").toLowerCase() !== "employee") {
      return NextResponse.json({ error: "Forbidden: Employee access required." }, { status: 403 });
    }

    await connectDB();
    const policy = (await HRPolicy.findOne({ key: "default" }).lean()) as {
      sections?: Array<{ published?: boolean; order?: number }>;
    } | null;
    if (!policy) {
      await HRPolicy.create({
        key: "default",
        sections: defaultHRPolicySections,
      });
      return NextResponse.json({ sections: defaultHRPolicySections });
    }

    return NextResponse.json({
      sections: (policy?.sections || [])
        .filter((section: { published?: boolean }) => section.published !== false)
        .sort((a: { order?: number }, b: { order?: number }) => (a.order || 0) - (b.order || 0)),
    });
  } catch (error) {
    console.error("Employee HR policy GET error:", error);
    return NextResponse.json({ error: "Failed to load HR policy." }, { status: 500 });
  }
}