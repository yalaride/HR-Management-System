// lib/cron/sync-reviews.ts
import connectDB from "@/lib/mongodb";
import { Employee } from "@/modals/Employee";
import { addCalendarMonths, durationMonthsOrDefault } from "@/lib/employment-period";

/**
 * Checks all active interns and probationers.
 * If their period end date is today or in the past, marks them as "Due Review".
 * Profiles saved without an end date get one from the join date and duration.
 */
export async function syncDueReviews() {
  await connectDB();

  const now = new Date();

  const missingEndDate = await Employee.find({
    status: "Active",
    employmentType: { $in: ["Internship", "Probation"] },
    reviewStatus: "Pending",
    periodEndDate: null,
    probationEndDate: null,
    internshipEndDate: null,
  });

  let backfilledCount = 0;
  for (const employee of missingEndDate) {
    if (!employee.joinDate) continue;

    const months = durationMonthsOrDefault(employee.lifecycleDurationMonths);
    const periodEnd = addCalendarMonths(new Date(employee.joinDate), months);

    employee.periodStartDate = employee.periodStartDate || employee.joinDate;
    employee.periodEndDate = periodEnd;
    employee.nextReviewDate = periodEnd;
    employee.lifecycleDurationMonths = employee.lifecycleDurationMonths || months;
    if (periodEnd.getTime() <= now.getTime()) {
      employee.reviewStatus = "Due Review";
      backfilledCount += 1;
    } else {
      employee.reviewStatus = "Pending";
    }

    if (employee.employmentType === "Probation") {
      employee.probationStartDate = employee.probationStartDate || employee.joinDate;
      employee.probationEndDate = periodEnd;
    } else {
      employee.internshipStartDate = employee.internshipStartDate || employee.joinDate;
      employee.internshipEndDate = periodEnd;
    }

    await employee.save();
  }

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
    markedDueCount: result.modifiedCount + backfilledCount,
  };
}

