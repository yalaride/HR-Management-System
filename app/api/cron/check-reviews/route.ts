import { NextResponse } from "next/server";
import { syncDueReviews } from "@/lib/cron/sync-reviews";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();

    // CRON_SECRET is mandatory — without it this endpoint stays locked.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron call" }, { status: 401 });
    }

    const reviewsResult = await syncDueReviews();

    return NextResponse.json({
      success: true,
      message: `Review sync completed at midnight. ${reviewsResult.markedDueCount} employee(s) marked Due Review.`,
      ...reviewsResult,
    });
  } catch (error) {
    console.error("Cron Review Sync Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
