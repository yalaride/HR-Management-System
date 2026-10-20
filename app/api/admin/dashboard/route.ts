import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Employee } from "@/modals/Employee";
import { Attendance } from "@/modals/Attendance";
import Leave from "@/modals/LeaveRequest";
import { getAdminUser } from "@/lib/auth";
import {
  getKarachiDateParts,
  getStoredBirthMonthDay,
  mongoDobMatchesMonthDays,
  shiftKarachiMonthDay,
} from "@/lib/birthday-date";
import { getProfileCompletion, type ProfileCompletionInput } from "@/lib/profile-completion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await connectDB();

    const activeEmployeesFilter = { status: { $ne: "Inactive" } };
    const local = getKarachiDateParts();
    const todayDateStr = local.dateStr;

    const upcomingMonthDays: string[] = [];
    for (let i = 1; i <= 7; i++) {
      upcomingMonthDays.push(shiftKarachiMonthDay(new Date(), i));
    }

    const [totalEmployees, departments, pendingLeaves, presentTodayCount, todayBirthdays, upcomingBirthdaysRaw, profileEmployees] =
      await Promise.all([
        Employee.countDocuments(activeEmployeesFilter),
        Employee.distinct("department", activeEmployeesFilter),
        Leave.countDocuments({ status: { $regex: /^pending$/i } }),
        Attendance.countDocuments({
          date: todayDateStr,
          status: { $in: ["On Time", "Late"] },
        }),
        Employee.find({
          status: "Active",
          dateOfBirth: { $ne: null },
          $or: [{ birthdayVisibility: { $exists: false } }, { birthdayVisibility: { $ne: "hidden" } }],
          ...mongoDobMatchesMonthDays([local.monthDay]),
        })
          .select("name department designation profilePhotoUrl dateOfBirth")
          .lean(),
        Employee.find({
          status: "Active",
          dateOfBirth: { $ne: null },
          $or: [{ birthdayVisibility: { $exists: false } }, { birthdayVisibility: { $ne: "hidden" } }],
          ...mongoDobMatchesMonthDays(upcomingMonthDays),
        })
          .select("name department designation profilePhotoUrl dateOfBirth")
          .lean(),
        Employee.find(activeEmployeesFilter)
          .select(
            "name department designation profilePhotoUrl phoneNumber address dateOfBirth gender maritalStatus emergencyContactName emergencyContactPhone"
          )
          .sort({ name: 1 })
          .lean(),
      ]);

    const totalDepartments = Array.isArray(departments)
      ? departments.filter(Boolean).length
      : 0;

    const todayAttendancePercent =
      totalEmployees > 0
        ? Math.min(100, Math.round((presentTodayCount / totalEmployees) * 100))
        : 0;

    const upcomingBirthdays = (
      upcomingBirthdaysRaw as {
        name?: string;
        department?: string;
        designation?: string;
        profilePhotoUrl?: string;
        dateOfBirth?: Date;
      }[]
    )
      .map((emp) => {
        const stored = emp.dateOfBirth
          ? getStoredBirthMonthDay(new Date(emp.dateOfBirth))
          : { monthDay: "" };
        let daysUntil = 0;
        let whenLabel = stored.monthDay;
        for (let i = 1; i <= 7; i++) {
          if (stored.monthDay === shiftKarachiMonthDay(new Date(), i)) {
            daysUntil = i;
            whenLabel = i === 1 ? "Tomorrow" : `In ${i} days`;
            break;
          }
        }
        return {
          name: emp.name || "Employee",
          department: emp.department,
          designation: emp.designation,
          profilePhotoUrl: emp.profilePhotoUrl,
          daysUntil,
          whenLabel,
          monthDay: stored.monthDay,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const profileRows = (
      profileEmployees as ({
        name?: string;
        department?: string;
        designation?: string;
      } & ProfileCompletionInput)[]
    ).map((emp) => {
      const completion = getProfileCompletion(emp);
      return {
        name: emp.name || "Employee",
        department: emp.department || "",
        designation: emp.designation || "",
        percent: completion.percent,
        missingFields: completion.missingFields,
        complete: completion.complete,
      };
    });
    const incompleteProfiles = profileRows
      .filter((row) => !row.complete)
      .sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name));
    const profileCompletionPercent =
      profileRows.length > 0
        ? Math.round(profileRows.reduce((sum, row) => sum + row.percent, 0) / profileRows.length)
        : 100;

    return NextResponse.json(
      {
        totalEmployees,
        totalDepartments,
        pendingLeaves,
        todayAttendancePercent,
        presentToday: totalEmployees > 0 ? presentTodayCount : 0,
        todayBirthdays,
        upcomingBirthdays,
        profileCompletionPercent,
        incompleteProfileCount: incompleteProfiles.length,
        incompleteProfiles,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}
