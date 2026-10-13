import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Payslip } from "@/modals/Payslip";
import { Employee } from "@/modals/Employee";
import { Attendance } from "@/modals/Attendance";
import CompanyDetails from "@/modals/CompanyDetails";
import { getSessionUser } from "@/lib/auth";

// TypeScript interfaces to ensure correct type resolution from lean queries
interface IEmployee {
  _id: string;
  userId?: string | { toString(): string };
  hourlyRate?: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  designation?: string;
  jobTitle?: string;
  role?: string;
}

interface ICompanyDetails {
  standardWorkingHours?: number;
}

interface IAttendance {
  workingHours?: number;
}

// Lean payslip doc; only employeeId is inspected directly, the rest is returned as-is
interface ILeanPayslip extends Record<string, unknown> {
  employeeId?: { _id?: { toString(): string } } | null;
}

export async function GET(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = sessionUser.role === "admin";

    await connectDB();

    // Non-admin users may only access payslips belonging to their own employee profile
    let ownEmployeeId: string | null = null;
    if (!isAdmin) {
      const ownEmployee = (await Employee.findOne({ userId: sessionUser.id })
        .select("_id")
        .lean()) as { _id: { toString(): string } } | null;
      ownEmployeeId = ownEmployee?._id?.toString() || null;
      if (!ownEmployeeId) {
        return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
      }
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const employeeId = searchParams.get("employeeId");
    const action = searchParams.get("action");

    // Case A: Fetch Auto-Calculated figures (Working hours * rate, and deductions)
    if (action === "calculate") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
      }
      const calcEmployeeId = searchParams.get("employeeId");
      const calcPeriod = searchParams.get("period"); // e.g. "June 2026"

      if (!calcEmployeeId || !calcPeriod) {
        return NextResponse.json({ error: "Missing calculation parameters" }, { status: 400 });
      }

      const employee = (await Employee.findById(calcEmployeeId).lean()) as IEmployee | null;
      if (!employee) {
        return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
      }

      const companyDetails = (await CompanyDetails.findOne().lean()) as ICompanyDetails | null;
      const standardHours = companyDetails?.standardWorkingHours || 160;

      // Extract Month and Year from Period string
      const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const parts = calcPeriod.toLowerCase().trim().split(/\s+/);
      let totalWorkingHours = 0;

      if (parts.length === 2) {
        const monthIndex = months.indexOf(parts[0]);
        const year = parseInt(parts[1], 10);
        if (monthIndex !== -1 && !isNaN(year)) {
          const yearStr = year.toString();
          const monthStr = String(monthIndex + 1).padStart(2, "0");
          const regexPattern = `^${yearStr}-${monthStr}`;

          // Fetch attendance logs by employee's user link
          const empUserId = employee.userId ? employee.userId.toString() : "";
          if (empUserId) {
            const attendances = (await Attendance.find({
              userId: empUserId,
              date: { $regex: regexPattern }
            }).lean()) as IAttendance[];

            totalWorkingHours = attendances.reduce((sum, att) => sum + (att.workingHours || 0), 0);
          }
        }
      }

      const hourlyRate = employee.hourlyRate || 0;
      // Formula: workinghour * hourlyrate = basicSalary
      const basicSalary = totalWorkingHours * hourlyRate;
      
      // Formula: standardWorkingHours * hourlyrate = standardSalary
      // deduction = standardSalary - basicSalary
      const standardSalary = standardHours * hourlyRate;
      const deductions = Math.max(0, standardSalary - basicSalary);

      return NextResponse.json({
        totalWorkingHours,
        hourlyRate,
        standardWorkingHours: standardHours,
        basicSalary: Number(basicSalary.toFixed(2)),
        deductions: Number(deductions.toFixed(2)),
      }, { status: 200 });
    }

    // Case B: Fetch a single specific payslip
    if (id) {
      const payslip = (await Payslip.findById(id)
        .populate("employeeId", "name jobTitle designation profilePhotoUrl")
        .lean()) as unknown as ILeanPayslip | null;

      if (!payslip) {
        return NextResponse.json({ error: "Payslip record not found" }, { status: 404 });
      }

      // Ownership check: employees may only download their own payslips
      if (!isAdmin) {
        const payslipEmployeeId =
          payslip.employeeId?._id?.toString() || payslip.employeeId?.toString() || "";
        if (!payslipEmployeeId || payslipEmployeeId !== ownEmployeeId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const companyDetails = (await CompanyDetails.findOne().lean()) as ICompanyDetails | null;
      return NextResponse.json({ payslip, companyDetails }, { status: 200 });
    }

    // Case C: Fetch all payslips based on authorization roles
    let query = {};

    if (!isAdmin) {
      // Employees are always scoped to their own active payslips
      query = { employeeId: ownEmployeeId, status: "Active" };
    } else if (employeeId) {
      query = { employeeId };
    }

    const payslips = await Payslip.find(query)
      .populate("employeeId", "name jobTitle designation profilePhotoUrl")
      .sort({ createdAt: -1 })
      .lean();

    const companyDetails = (await CompanyDetails.findOne().lean()) as ICompanyDetails | null;

    return NextResponse.json({ payslips, companyDetails }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch payslips:", error);
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await connectDB();
    const body = await request.json();
    const {
      employeeId,
      period,
      basicSalary,
      allowances,
      bonus,
      deductions,
      tax,
      taxMode,
      paymentMethod,
      paymentDate,
    } = body;

    const parsedBasicSalary = Number(basicSalary);
    const parsedAllowances = Number(allowances || 0);
    const parsedBonus = Number(bonus || 0);
    const parsedDeductions = Number(deductions || 0);
    const parsedTax = Math.max(0, Number(tax || 0));
    const parsedTaxMode = taxMode === "add" ? "add" : "deduct";
    const taxEffect = parsedTaxMode === "add" ? parsedTax : -parsedTax;
    const parsedNetPay =
      parsedBasicSalary + parsedAllowances + parsedBonus - parsedDeductions + taxEffect;
    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : undefined;

    if (!employeeId || !period || Number.isNaN(parsedBasicSalary) || parsedBasicSalary <= 0) {
      return NextResponse.json(
        { error: "Missing required fields or invalid salary value" },
        { status: 400 }
      );
    }
    if (
      [parsedAllowances, parsedBonus, parsedDeductions, parsedTax, parsedNetPay].some((value) =>
        Number.isNaN(value)
      )
    ) {
      return NextResponse.json({ error: "Salary figures must be valid numbers." }, { status: 400 });
    }
    if (parsedNetPay < 0) {
      return NextResponse.json(
        { error: "Tax and deductions cannot be more than the total earnings." },
        { status: 400 }
      );
    }

    const employee = (await Employee.findById(employeeId).lean()) as IEmployee | null;
    const employeeName = employee && typeof employee === "object" && "name" in employee
      ? (employee.name || `${employee.firstName || ""} ${employee.lastName || ""}`.trim())
      : "Unknown Employee";
    const employeeRole = employee && typeof employee === "object"
      ? (employee.designation || employee.jobTitle || employee.role || "No Specified Title")
      : "No Specified Title";

    // Each generation is a separate paid record — previous slips for the same
    // employee/period stay visible in the ledger (no auto-suspend).
    const newPayslip = await Payslip.create({
      employeeId,
      employeeName,
      employeeRole,
      period,
      basicSalary: parsedBasicSalary,
      allowances: parsedAllowances,
      bonus: parsedBonus,
      deductions: parsedDeductions,
      tax: parsedTax,
      taxMode: parsedTaxMode,
      netPay: parsedNetPay,
      paymentMethod,
      paymentDate: parsedPaymentDate,
      status: "Active",
    });

    const populatedPayslip = await Payslip.findById(newPayslip._id)
      .populate("employeeId", "name jobTitle designation")
      .lean();

    if (!populatedPayslip) {
      throw new Error("Failed to retrieve the generated payslip document.");
    }

    return NextResponse.json(populatedPayslip, { status: 201 });
  } catch (error) {
    console.error("Failed to create payslip record:", error);
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}