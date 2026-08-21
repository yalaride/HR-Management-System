import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canViewFullAuditLogs } from "@/lib/audit-log-access";
import { listActivityFeed } from "@/lib/activity-feed";

export const dynamic = "force-dynamic";

/** Lightweight check for sidebar — no log payload. */
export async function HEAD() {
  const user = await getSessionUser();
  if (!user || user.role !== "employee" || !canViewFullAuditLogs(user.email)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "employee") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canViewFullAuditLogs(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Access probe used by the sidebar (no filters / no heavy query)
    if (searchParams.get("probe") === "1") {
      return NextResponse.json({ canView: true }, { status: 200 });
    }

    const typeFilter = searchParams.get("type") || "all";
    const searchQuery = searchParams.get("search") || "";

    const logs = await listActivityFeed({ typeFilter, searchQuery, limit: 100 });
    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    console.error("Employee activity feed error:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}
