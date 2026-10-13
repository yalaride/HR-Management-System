// lib/cron/sync-reviews.ts
import connectDB from "@/lib/mongodb";
import { Employee } from "@/modals/Employee";

/**
 * Checks all active interns and probationers.
 * If their periodEndDate is today or in the past, marks them as "Due Review".
 */
export async function syncDueReviews() {
  await connectDB();

  const now = new Date();

  // Single atomic update: eliminates race conditions and loops
  const result = await Employee.updateMany(
    {
      status: "Active",
      employmentType: { $in: ["Internship", "Probation"] },
      reviewStatus: "Pending", // Only review those not yet reviewed
      $or: [
        { periodEndDate: { $lte: now } },
        { probationEndDate: { $lte: now } },
        { internshipEndDate: { $lte: now } },
      ],
    },
    {
      $set: { reviewStatus: "Due Review" },
    }
  );

  return {
    syncedAt: now.toISOString(),
    markedDueCount: result.modifiedCount,
  };
}

