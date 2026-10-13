import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Employee } from "@/modals/Employee";
import User from "@/modals/User";
import { ActivityLog } from "@/modals/ActivityLog";
import { sendBirthdayEmail } from "@/lib/email/birthday-email";
import {
  sendAdminBirthdayDigest,
  sendAdminUpcomingBirthdayReminder,
  BirthdayAdminCelebrant,
} from "@/lib/email/admin-birthday-digest";
import { logEmailIssue } from "@/lib/activity-log-email";
import {
  getKarachiDateParts,
  getStoredBirthMonthDay,
  mongoDobMatchesMonthDays,
  shiftKarachiMonthDay,
} from "@/lib/birthday-date";

/** How many past days to retry missed birthday emails (same calendar year). */
const CATCH_UP_DAYS = 14;
/** How many upcoming days to include in the admin reminder email. */
const UPCOMING_REMINDER_DAYS = 3;

interface CelebrantEmployee {
  _id: { toString(): string };
  name: string;
  designation?: string;
  department?: string;
  dateOfBirth?: Date;
  birthdayEmailStatus?: string;
  birthdayEmailSentYear?: number | null;
  userId?: { _id?: { toString(): string }; email?: string } | null;
}

export const dynamic = "force-dynamic";

function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://hr-management-system-rose.vercel.app";
}

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    await connectDB();

    const now = new Date();
    const local = getKarachiDateParts(now);

    // Today + last CATCH_UP_DAYS (retry Failed / missed runs)
    const targetMonthDays: string[] = [local.monthDay];
    for (let i = 1; i <= CATCH_UP_DAYS; i++) {
      targetMonthDays.push(shiftKarachiMonthDay(now, -i));
    }

    const celebrants = (await Employee.find({
      status: "Active",
      dateOfBirth: { $ne: null },
      $or: [{ birthdayVisibility: { $exists: false } }, { birthdayVisibility: { $ne: "hidden" } }],
      $nor: [
        {
          birthdayEmailStatus: "Sent",
          birthdayEmailSentYear: local.year,
        },
      ],
      ...mongoDobMatchesMonthDays(targetMonthDays),
    })
      .populate("userId", "email")
      .lean()) as unknown as CelebrantEmployee[];

    const results: BirthdayAdminCelebrant[] = [];

    for (const emp of celebrants) {
      const email = emp.userId?.email?.trim() || null;
      const actorId = emp.userId?._id?.toString() || emp._id.toString();
      const dob = emp.dateOfBirth ? new Date(emp.dateOfBirth) : null;
      const stored = dob ? getStoredBirthMonthDay(dob) : null;
      const isToday = stored?.monthDay === local.monthDay;

      if (!email) {
        const reason = "No linked user email on employee account";
        await logEmailIssue({
          userId: actorId,
          kind: "birthday",
          subjectLabel: emp.name,
          emailAddress: null,
          reason,
          status: "Skipped",
        });

        results.push({
          name: emp.name,
          email: null,
          designation: emp.designation,
          department: emp.department,
          emailStatus: "Skipped",
          reason,
        });
        continue;
      }

      const sendResult = await sendBirthdayEmail(
        email,
        emp.name,
        emp.designation,
        emp.department
      );

      if (sendResult.ok) {
        await Employee.updateOne(
          { _id: emp._id },
          {
            $set: {
              birthdayEmailStatus: "Sent",
              birthdayEmailSentYear: local.year,
            },
          }
        );

        await ActivityLog.create({
          userId: actorId,
          activityType: "BIRTHDAY_EMAIL",
          date: local.dateStr,
          timestamp: new Date(),
          description: isToday
            ? `Automated birthday email successfully delivered to ${emp.name} (${email}).`
            : `Catch-up birthday email delivered to ${emp.name} (${email}) for ${stored?.monthDay || "prior day"}.`,
          metadata: {
            status: "Sent",
            emailAddress: email,
          },
        });

        results.push({
          name: emp.name,
          email,
          designation: emp.designation,
          department: emp.department,
          emailStatus: "Success",
          reason: isToday ? undefined : `Catch-up for ${stored?.monthDay}`,
        });
      } else {
        const reason = sendResult.error || "Resend delivery failed";

        await Employee.updateOne(
          { _id: emp._id },
          { $set: { birthdayEmailStatus: "Failed" } }
        );

        await logEmailIssue({
          userId: actorId,
          kind: "birthday",
          subjectLabel: emp.name,
          emailAddress: email,
          reason,
          status: "Failed",
        });

        results.push({
          name: emp.name,
          email,
          designation: emp.designation,
          department: emp.department,
          emailStatus: "Failed",
          reason,
        });
      }
    }

    // Admins to notify
    const admins = (await User.find({ role: "admin" }).select("_id email").lean()) as {
      _id: { toString(): string };
      email?: string;
    }[];
    const adminEmails = admins
      .map((a) => a.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e));

    const birthdaysUrl = `${getAppBaseUrl()}/admin/birthdays`;
    let adminDigest = { sent: 0, failed: 0, failures: [] as { email: string; error: string }[] };

    if (results.length > 0 && adminEmails.length > 0) {
      adminDigest = await sendAdminBirthdayDigest(
        adminEmails,
        local.dateStr,
        results,
        birthdaysUrl
      );

      for (const failure of adminDigest.failures) {
        const admin = admins.find((a) => a.email?.trim().toLowerCase() === failure.email);
        await logEmailIssue({
          userId: admin?._id?.toString() || "system",
          kind: "birthday_admin",
          subjectLabel: "admin digest",
          emailAddress: failure.email,
          reason: failure.error,
          status: "Failed",
        });
      }
    }

    // Upcoming reminder (tomorrow → +UPCOMING_REMINDER_DAYS)
    const upcomingMonthDays: string[] = [];
    for (let i = 1; i <= UPCOMING_REMINDER_DAYS; i++) {
      upcomingMonthDays.push(shiftKarachiMonthDay(now, i));
    }

    const upcoming = (await Employee.find({
      status: "Active",
      dateOfBirth: { $ne: null },
      $or: [{ birthdayVisibility: { $exists: false } }, { birthdayVisibility: { $ne: "hidden" } }],
      ...mongoDobMatchesMonthDays(upcomingMonthDays),
    })
      .select("name designation department dateOfBirth")
      .lean()) as unknown as CelebrantEmployee[];

    const upcomingList = upcoming.map((emp) => {
      const stored = emp.dateOfBirth
        ? getStoredBirthMonthDay(new Date(emp.dateOfBirth))
        : { monthDay: "" };
      let whenLabel = stored.monthDay;
      for (let i = 1; i <= UPCOMING_REMINDER_DAYS; i++) {
        if (stored.monthDay === shiftKarachiMonthDay(now, i)) {
          whenLabel = i === 1 ? "Tomorrow" : `In ${i} days (${stored.monthDay})`;
          break;
        }
      }
      return {
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        whenLabel,
      };
    });

    let upcomingReminder = { sent: 0, failed: 0, failures: [] as { email: string; error: string }[] };
    if (upcomingList.length > 0 && adminEmails.length > 0) {
      upcomingReminder = await sendAdminUpcomingBirthdayReminder(
        adminEmails,
        local.dateStr,
        upcomingList,
        birthdaysUrl
      );

      for (const failure of upcomingReminder.failures) {
        const admin = admins.find((a) => a.email?.trim().toLowerCase() === failure.email);
        await logEmailIssue({
          userId: admin?._id?.toString() || "system",
          kind: "birthday_admin",
          subjectLabel: "upcoming reminder",
          emailAddress: failure.email,
          reason: failure.error,
          status: "Failed",
        });
      }
    }

    return NextResponse.json(
      {
        message: `Birthday cron finished for Asia/Karachi ${local.dateStr}`,
        date: local.dateStr,
        processedCount: celebrants.length,
        results,
        adminDigest,
        upcomingReminder: {
          count: upcomingList.length,
          sent: upcomingReminder.sent,
          failed: upcomingReminder.failed,
          names: upcomingList.map((u) => u.name),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await logEmailIssue({
        userId: "system",
        kind: "system",
        subjectLabel: "birthday cron",
        reason: message || "Birthday cron crashed",
        status: "Failed",
      });
    } catch {
      // ignore secondary logging failure
    }

    return NextResponse.json(
      {
        error: "Automated birthday cron execution failed",
        details: message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
