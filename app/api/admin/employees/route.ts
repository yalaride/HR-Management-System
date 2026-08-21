import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/modals/User";
import { Employee } from "@/modals/Employee";
import CompanyDetails from "@/modals/CompanyDetails"; // Adjust this path to match where your model is saved
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email/welcome-email";
import { getAdminUser } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await connectDB();

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
      userId?: { email?: string } | null;
    }
    // lean + select: return only the fields the directory actually renders
    const employees = (await Employee.find({ status: { $ne: "Inactive" } })
      .select("name department status designation joinDate salary hourlyRate profilePhotoUrl profilePhotoURL userId")
      .populate("userId", "email")
      .lean()) as unknown as EmployeeDoc[];


    // Map backend properties so frontend gets consistent keys for dates + compensation
    const formattedEmployees = employees.map((emp) => ({
      id: emp._id.toString(),
      name: emp.name,
      email: emp.userId?.email || "",
      department: emp.department,
      status: emp.status,
      designation: emp.designation,
      joinDate: emp.joinDate ? new Date(emp.joinDate).toISOString() : null,
      salary: emp.salary !== undefined && emp.salary !== null ? Number(emp.salary) : 0,
      hourlyRate:
        emp.hourlyRate !== undefined && emp.hourlyRate !== null
          ? Number(emp.hourlyRate)
          : 0,
      // Cloudinary image link stored in DB
      profilePhotoUrl: emp.profilePhotoUrl || emp.profilePhotoURL || "",
    }));

    return NextResponse.json(formattedEmployees, { status: 200 });
  } catch (error) {
    console.error("Fetch employees error:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message || "Failed to load directory" },
      { status: 500 }
    );
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
    const { name, email, password, department, status, designation, joinDate, salary } = body;

    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedDesignation = typeof designation === "string" ? designation.trim() : "";
    const normalizedDepartment = typeof department === "string" ? department.trim() : "";

    if (!normalizedName || !email || !password || !normalizedDepartment || !normalizedDesignation || !joinDate || salary === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const parsedJoinDate = new Date(joinDate);
    if (isNaN(parsedJoinDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid join date format" },
        { status: 400 }
      );
    }

    const parsedSalary = Number(salary);
    if (isNaN(parsedSalary) || parsedSalary < 0) {
      return NextResponse.json(
        { error: "Salary must be a valid positive number" },
        { status: 400 }
      );
    }

    // 1. Retrieve Standard Working Hours from Company Settings
   let standardHours = 160; // Fallback default
try {
  const company = await CompanyDetails.findOne();
  if (company && company.standardWorkingHours && company.standardWorkingHours > 0) {
    standardHours = company.standardWorkingHours;
  }
} catch (err) {
  console.warn("Unable to fetch Company Details, using fallback 160 hours:", err);
}

// 2. Calculate Hourly Rate
const parsedHourlyRate = parsedSalary / standardHours;

    const assignedRole = "employee"; 

    const newUser = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
    });

    const newEmployee = await Employee.create({
      userId: newUser._id,
      name: normalizedName,
      designation: normalizedDesignation,
      joinDate: parsedJoinDate,
      department: normalizedDepartment,
      salary: parsedSalary,
      hourlyRate: parsedHourlyRate, // Saved programmatically to the database
      status: typeof status === "string" && status.trim() ? status.trim() : "Active",
      jobTitle: normalizedDesignation,
    });

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

    const newEmployeeHourlyRate = (newEmployee as { hourlyRate?: unknown }).hourlyRate;

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
      hourlyRate:
        typeof newEmployeeHourlyRate === "number" ? newEmployeeHourlyRate : undefined,
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
    return NextResponse.json(
      { error: message || "Internal Server Error" },
      { status: 500 }
    );
  }
}