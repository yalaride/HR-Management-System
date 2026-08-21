import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { listActivityFeed } from "@/lib/activity-feed";

export async function GET(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type") || "all";
    const searchQuery = searchParams.get("search") || "";

    const logs = await listActivityFeed({ typeFilter, searchQuery, limit: 100 });
    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch activity logs:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}
