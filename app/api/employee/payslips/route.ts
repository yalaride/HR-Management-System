import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Employee } from "@/modals/Employee";
import { Payslip } from "@/modals/Payslip";

export async function GET() {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employee = await Employee.findOne({ userId })
      .select("_id")
      .lean<{ _id: unknown }>();

    const employeeId = employee?._id;
    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee profile not found" },
        { status: 404 }
      );
    }

    // Filter to only display Active payslips for the employee
    // Explicitly select `version` because the UI relies on it for the Version column.
    const payslips = await Payslip.find({ employeeId, status: "Active" })
      .select(
        "_id employeeId period basicSalary allowances bonus deductions tax taxMode netPay paymentMethod paymentDate status version"
      )
      .populate("employeeId", "name jobTitle")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(payslips, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch employee payslips:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}