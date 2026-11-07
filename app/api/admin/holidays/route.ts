import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getAdminUser } from "@/lib/auth";
import { Holiday } from "@/modals/Holiday";
import { Employee } from "@/modals/Employee";
import {
  buildHolidayAnnouncement,
  holidaySubject,
  isIsoDate,
  nextOfficeDay,
} from "@/lib/holiday-announcement";
import { sendHolidayEmail } from "@/lib/email/holiday-email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }
    await connectDB();
    const holidays = await Holiday.find().sort({ startDate: 1 }).lean();
    return NextResponse.json({ holidays });
  } catch (error) {
    console.error("List holidays error:", error);
    return NextResponse.json({ error: "Failed to load holidays" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const startDate = typeof body.startDate === "string" ? body.startDate : "";
    const endDate = typeof body.endDate === "string" ? body.endDate : "";
    const announcement =
      typeof body.announcement === "string" && body.announcement.trim()
        ? body.announcement.trim()
        : buildHolidayAnnouncement({ title, startDate, endDate });
    const subject =
      typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : holidaySubject(title);

    if (!title) {
      return NextResponse.json({ error: "Holiday name is required." }, { status: 400 });
    }
    if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) {
      return NextResponse.json({ error: "Choose a valid from and to date." }, { status: 400 });
    }

    await connectDB();
    const overlap = await Holiday.findOne({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    }).select("_id title");
    if (overlap) {
      return NextResponse.json(
        { error: `These dates overlap ${overlap.title}. Choose a different range.` },
        { status: 400 }
      );
    }

    const recipients = await Employee.find({ status: { $in: ["Active", "On Leave"] } })
      .select("name userId")
      .populate("userId", "email")
      .lean();

    let sentCount = 0;
    let failedCount = 0;
    for (const employee of recipients) {
      const account = employee.userId as { email?: string } | null;
      const email = account?.email?.trim();
      if (!email) {
        failedCount += 1;
        continue;
      }
      const result = await sendHolidayEmail(email, subject, {
        title,
        startDate,
        endDate,
        resumeLabel: nextOfficeDay(endDate),
        announcement,
      });
      if (result.ok) sentCount += 1;
      else failedCount += 1;
    }

    const holiday = await Holiday.create({
      title,
      startDate,
      endDate,
      resumeDate: nextOfficeDay(endDate),
      subject,
      announcement,
      sentCount,
      failedCount,
      announcedAt: new Date(),
      createdBy: admin.id,
    });

    return NextResponse.json(
      {
        holiday,
        sentCount,
        failedCount,
        message:
          sentCount > 0
            ? `Holiday saved. Email sent to ${sentCount} employee${sentCount === 1 ? "" : "s"}.`
            : "Holiday saved. No holiday email was delivered.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create holiday error:", error);
    return NextResponse.json({ error: "Failed to save the holiday" }, { status: 500 });
  }
}
