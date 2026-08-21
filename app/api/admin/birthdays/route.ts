import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Employee } from "@/modals/Employee";
import CompanyDetails from "@/modals/CompanyDetails";
import { getAdminUser } from "@/lib/auth";
import { getKarachiDateParts, getStoredBirthMonthDay } from "@/lib/birthday-date";

export async function GET(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month") || "all";
    const deptParam = searchParams.get("department") || "all";
    const searchParam = searchParams.get("search") || "";

    const query: {
      status: string;
      dateOfBirth: Record<string, unknown>;
      $and: Record<string, unknown>[];
      department?: string;
    } = {
      status: "Active",
      dateOfBirth: { $ne: null },
      $and: [
        {
          $or: [
            { birthdayVisibility: { $exists: false } },
            { birthdayVisibility: { $ne: "hidden" } },
          ],
        },
      ],
    };

    if (deptParam !== "all") {
      query.department = deptParam;
    }

    if (searchParam) {
      query.$and.push({
        $or: [
          { name: { $regex: searchParam, $options: "i" } },
          { designation: { $regex: searchParam, $options: "i" } },
        ],
      });
    }

    interface BirthdayEmployee {
      _id: { toString(): string };
      employeeId?: string;
      name: string;
      department?: string;
      designation?: string;
      dateOfBirth: string | Date;
      birthdayEmailStatus?: string;
      birthdayEmailSentYear?: number;
      userId?: { email?: string } | null;
      profilePhotoUrl?: string;
      profilePhotoURL?: string;
      profilePicture?: string;
      image?: string;
      picture?: string;
    }

    const [company, rawEmployees] = await Promise.all([
      CompanyDetails.findOne().lean() as Promise<{ departments?: string[] } | null>,
      Employee.find(query)
        .populate("userId", "email")
        .lean() as Promise<unknown> as Promise<BirthdayEmployee[]>,
    ]);
    const departmentsList: string[] = company?.departments || [];

    const karachi = getKarachiDateParts();
    const currentMonthIdx = karachi.month - 1; // 0-based for UI
    const currentDayNum = karachi.day;
    const currentKarachiYear = karachi.year;

    const formattedEmployees = rawEmployees.map((emp) => {
      const dob = new Date(emp.dateOfBirth);
      const stored = getStoredBirthMonthDay(dob);
      const birthMonth = stored.month - 1; // 0-based
      const birthDay = stored.day;
      const birthYear = dob.getUTCFullYear();

      let displayStatus = emp.birthdayEmailStatus || "Pending";
      if (emp.birthdayEmailSentYear && emp.birthdayEmailSentYear !== currentKarachiYear) {
        displayStatus = "Pending";
      }

      return {
        id: emp.employeeId || emp._id.toString(),
        name: emp.name,
        email: emp.userId?.email || "",
        department: emp.department,
        designation: emp.designation,
        profilePhotoUrl:
          emp.profilePhotoUrl ||
          emp.profilePhotoURL ||
          emp.profilePicture ||
          emp.image ||
          emp.picture ||
          "",
        birthDate: `${birthYear}-${String(birthMonth + 1).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
        birthDay,
        birthMonth,
        birthdayEmailStatus: displayStatus,
      };
    });

    let todayCount = 0;
    let monthCount = 0;
    let upcomingCount = 0;

    const targetMonthIdx = monthParam === "all" ? currentMonthIdx : parseInt(monthParam, 10);

    formattedEmployees.forEach((emp) => {
      if (emp.birthMonth === targetMonthIdx) {
        monthCount++;
      }

      if (emp.birthMonth === currentMonthIdx && emp.birthDay === currentDayNum) {
        todayCount++;
      }

      if (emp.birthMonth === currentMonthIdx) {
        if (emp.birthDay > currentDayNum) upcomingCount++;
      } else if (emp.birthMonth > currentMonthIdx) {
        upcomingCount++;
      }
    });

    let finalEmployees = formattedEmployees;
    if (monthParam !== "all") {
      const parsedMonth = parseInt(monthParam, 10);
      finalEmployees = finalEmployees.filter((emp) => emp.birthMonth === parsedMonth);
    }

    return NextResponse.json({
      departments: departmentsList,
      metrics: {
        todayCount,
        monthCount,
        upcomingCount,
      },
      employees: finalEmployees,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
