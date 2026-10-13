import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/modals/User";
import { Employee } from "@/modals/Employee";
import CompanyDetails from "@/modals/CompanyDetails";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email/welcome-email";
import { getAdminUser } from "@/lib/auth";
import { syncDueReviews } from "@/lib/cron/sync-reviews";
import { applyEmployeeLeaveProration } from "@/lib/leave-proration";

interface EmployeeExtension {
  type?: string;
  stage?: string;
  previousEndDate: Date | string;
  newEndDate: Date | string;
  durationMonths: number;
  reason: string;
  extendedBy?: string;
  extendedAt?: Date | string;
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await connectDB();

    // FAILSAFE: Trigger sync so overdue reviews update immediately
    await syncDueReviews();

    interface EmployeeDoc {
      _id: { toString(): string };
      name: string;
      department?: string;
      status?: string;
      designation?: string;
      joinDate?: string | Date;
      salary?: number | null;
      hourlyRate?: number | null;
      profilePhotoUrl?: string;
      profilePhotoURL?: string;
      employmentType?: string;
      reviewStatus?: string;
      periodStartDate?: Date | null;
      periodEndDate?: Date | null;
      lifecycleDurationMonths?: number | null;
      nextReviewDate?: Date | null;
      probationEndDate?: Date | null;
      internshipEndDate?: Date | null;
      confirmationDate?: Date | null;
      extensions?: EmployeeExtension[];
      userId?: { email?: string } | null;
    }

    const employees = (await Employee.find({ status: { $ne: "Inactive" } })
      .select(
        "name department status designation joinDate salary hourlyRate profilePhotoUrl profilePhotoURL userId employmentType reviewStatus periodStartDate periodEndDate lifecycleDurationMonths nextReviewDate probationEndDate internshipEndDate confirmationDate extensions"
      )
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .lean()) as unknown as EmployeeDoc[];

    const formattedEmployees = employees.map((emp) => {
      const targetEndDate =
        emp.periodEndDate || emp.probationEndDate || emp.internshipEndDate || null;

      return {
        id: emp._id.toString(),
        name: emp.name,
        email: emp.userId?.email || "",
        department: emp.department,
        status: emp.status,
        designation: emp.designation,
        joinDate: emp.joinDate ? new Date(emp.joinDate).toISOString() : null,
        salary: emp.salary !== undefined && emp.salary !== null ? Number(emp.salary) : 0,
        hourlyRate:
          emp.hourlyRate !== undefined && emp.hourlyRate !== null ? Number(emp.hourlyRate) : 0,
        profilePhotoUrl: emp.profilePhotoUrl || emp.profilePhotoURL || "",
        employmentType: emp.employmentType || "Probation",
        reviewStatus: emp.reviewStatus || "Pending",
        periodEndDate: targetEndDate ? new Date(targetEndDate).toISOString() : null,
        periodStartDate: emp.periodStartDate ? new Date(emp.periodStartDate).toISOString() : null,
        lifecycleDurationMonths: emp.lifecycleDurationMonths ?? null,
        nextReviewDate: emp.nextReviewDate ? new Date(emp.nextReviewDate).toISOString() : null,
        confirmationDate: emp.confirmationDate
          ? new Date(emp.confirmationDate).toISOString()
          : null,
        extensions: emp.extensions || [],
      };
    });

    return NextResponse.json(formattedEmployees, { status: 200 });
  } catch (error) {
    console.error("Fetch employees error:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message || "Failed to load directory" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await connectDB();

    const body = await request.json();
    const {
      name,
      email,
      password,
      department,
      status,
      designation,
      joinDate,
      salary,
      employmentType = "Probation",
      durationMonths = 3,
    } = body;

    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedDesignation = typeof designation === "string" ? designation.trim() : "";
    const normalizedDepartment = typeof department === "string" ? department.trim() : "";

    if (
      !normalizedName ||
      !email ||
      !password ||
      !normalizedDepartment ||
      !normalizedDesignation ||
      !joinDate ||
      salary === undefined
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    const allowedEmploymentTypes = ["Internship", "Probation", "Permanent", "Contract"] as const;
    const allowedStatuses = ["Active", "Inactive", "On Leave", "Terminated"] as const;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }
    if (!allowedEmploymentTypes.includes(employmentType)) {
      return NextResponse.json({ error: "Invalid employment type" }, { status: 400 });
    }
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid employee status" }, { status: 400 });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const parsedJoinDate = new Date(joinDate);
    if (isNaN(parsedJoinDate.getTime())) {
      return NextResponse.json({ error: "Invalid join date format" }, { status: 400 });
    }

    const now = new Date();
    if (parsedJoinDate.getTime() > now.getTime()) {
      return NextResponse.json({ error: "Join date cannot be in the future" }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // VALIDATION: Employees joining today cannot be directly set as "Permanent"
    // -------------------------------------------------------------------------
    const isJoinDateToday =
      parsedJoinDate.getUTCFullYear() === now.getUTCFullYear() &&
      parsedJoinDate.getUTCMonth() === now.getUTCMonth() &&
      parsedJoinDate.getUTCDate() === now.getUTCDate();

    if (isJoinDateToday && employmentType === "Permanent") {
      return NextResponse.json(
        {
          error:
            "Employees joining today cannot be set as Permanent. Please select Probation, Internship, or Contract.",
        },
        { status: 400 }
      );
    }

    const parsedSalary = Number(salary);
    if (isNaN(parsedSalary) || parsedSalary < 0) {
      return NextResponse.json({ error: "Salary must be a valid positive number" }, { status: 400 });
    }

    // 1. Hourly Rate
    let standardHours = 160;
    try {
      const company = await CompanyDetails.findOne();
      if (company && company.standardWorkingHours && company.standardWorkingHours > 0) {
        standardHours = company.standardWorkingHours;
      }
    } catch (err) {
      console.warn("Unable to fetch Company Details, using fallback 160 hours:", err);
    }
    const parsedHourlyRate = parsedSalary / standardHours;

    // -------------------------------------------------------------------------
    // 2. PERIOD & REVIEW DATE CALCULATION (Strictly based on joinDate)
    // -------------------------------------------------------------------------
    let periodEndDate: Date | null = null;
    let nextReviewDate: Date | null = null;
    let reviewStatus = "Pending";
    let confirmationDate: Date | null = null;

    const monthsToAdd = Number(durationMonths);

    if (employmentType === "Internship" || employmentType === "Probation") {
      if (!Number.isInteger(monthsToAdd) || ![1, 2, 3, 6].includes(monthsToAdd)) {
        return NextResponse.json(
          { error: "Duration must be 1, 2, 3, or 6 months." },
          { status: 400 }
        );
      }

      // Calculation is strictly derived from joinDate
      periodEndDate = new Date(parsedJoinDate);
      periodEndDate.setMonth(periodEndDate.getMonth() + monthsToAdd);
      nextReviewDate = new Date(periodEndDate);

      if (periodEndDate.getTime() <= now.getTime()) {
        return NextResponse.json(
          {
            error:
              `${employmentType} cannot be assigned because its ${monthsToAdd}-month period has already ended. ` +
              "Please select Permanent or Contract for an employee whose lifecycle period is complete.",
          },
          { status: 400 }
        );
      }

      reviewStatus = "Pending";
    } else if (employmentType === "Permanent") {
      confirmationDate = parsedJoinDate;
      reviewStatus = "Completed";
      nextReviewDate = null;
    } else {
      reviewStatus = "Completed";
      nextReviewDate = null;
    }

    // 3. Create User Account
    const newUser = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      role: "employee",
    });

    // 4. Create Employee Record
    const newEmployee = await Employee.create({
      userId: newUser._id,
      name: normalizedName,
      designation: normalizedDesignation,
      joinDate: parsedJoinDate,
      department: normalizedDepartment,
      salary: parsedSalary,
      hourlyRate: parsedHourlyRate,
      status: typeof status === "string" && status.trim() ? status.trim() : "Active",
      jobTitle: normalizedDesignation,
      employmentType,
      reviewStatus,
      periodStartDate: parsedJoinDate,
      periodEndDate,
      nextReviewDate,
      lifecycleDurationMonths: periodEndDate ? monthsToAdd : null,
      probationStartDate: employmentType === "Probation" ? parsedJoinDate : null,
      probationEndDate: employmentType === "Probation" ? periodEndDate : null,
      internshipStartDate: employmentType === "Internship" ? parsedJoinDate : null,
      internshipEndDate: employmentType === "Internship" ? periodEndDate : null,
      confirmationDate,
      extensions: [],
    });

    // Seed all leave balances from the joining month. Non-permanent employees
    // accumulate the balance but cannot use it until they become Permanent.
    if (newEmployee.userId && newEmployee.joinDate) {
      try {
        await applyEmployeeLeaveProration(
          newUser._id.toString(),
          new Date(newEmployee.joinDate)
        );
      } catch (prorationError) {
        console.error("Leave balance initialization error on create:", prorationError);
      }
    }

    // 5. Send Welcome Email
    const emailResult = await sendWelcomeEmail(name, normalizedEmail, password);
    if (!emailResult.ok) {
      const { logEmailIssue } = await import("@/lib/activity-log-email");
      await logEmailIssue({
        userId: newUser._id.toString(),
        kind: "welcome",
        subjectLabel: name,
        emailAddress: normalizedEmail,
        reason: emailResult.error || "Welcome email delivery failed",
        status: "Failed",
      });
    }

    const formattedNewEmployee = {
      id: newEmployee._id.toString(),
      name: newEmployee.name,
      role: newEmployee.designation,
      email: normalizedEmail,
      department: newEmployee.department,
      status: newEmployee.status,
      designation: newEmployee.designation,
      joinDate: newEmployee.joinDate ? newEmployee.joinDate.toISOString() : undefined,
      salary: typeof newEmployee.salary === "number" ? newEmployee.salary : undefined,
      hourlyRate: typeof newEmployee.hourlyRate === "number" ? newEmployee.hourlyRate : undefined,
      employmentType: newEmployee.employmentType,
      reviewStatus: newEmployee.reviewStatus,
      periodStartDate: newEmployee.periodStartDate ? newEmployee.periodStartDate.toISOString() : null,
      periodEndDate: periodEndDate ? periodEndDate.toISOString() : null,
      nextReviewDate: nextReviewDate ? nextReviewDate.toISOString() : null,
      lifecycleDurationMonths: newEmployee.lifecycleDurationMonths ?? null,
      confirmationDate: confirmationDate ? confirmationDate.toISOString() : null,
    };

    return NextResponse.json(
      {
        message: emailResult.ok
          ? "Employee registered and welcome email sent successfully"
          : "Employee registered successfully (email delivery pending domain setup)",
        employee: formattedNewEmployee,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Database registration error:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}