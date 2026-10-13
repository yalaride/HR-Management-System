import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/modals/User";
import { Employee } from "@/modals/Employee";
import CompanyDetails from "@/modals/CompanyDetails";
import { DepartmentHead } from "@/modals/DepartmentHead";
import { getAdminUser } from "@/lib/auth";
import { isValidObjectId } from "mongoose";
import { applyEmployeeLeaveProration } from "@/lib/leave-proration";
import {
  effectiveEmploymentPeriod,
  isEmploymentPeriodDue,
} from "@/lib/employment-period";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid employee id" }, { status: 400 });
    }
    const body = await request.json();

    const {
      name,
      email,
      designation,
      joinDate,
      department,
      status,
      salary,
      employmentType,
      durationMonths,    // In case duration is edited alongside join date
      reviewAction,      // "NONE" | "EXTEND" | "CONFIRM"
      extendMonths,      // 1, 2, or 3
      extensionReason,   // Mandatory reason
      confirmationReason,
    } = body;

    const allowedEmploymentTypes = ["Internship", "Probation", "Permanent", "Contract"];
    const allowedStatuses = ["Active", "Inactive", "On Leave", "Terminated"];
    const allowedReviewActions = ["NONE", "EXTEND", "CONFIRM"];

    if (employmentType !== undefined && !allowedEmploymentTypes.includes(employmentType)) {
      return NextResponse.json({ error: "Invalid employment type" }, { status: 400 });
    }
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid employee status" }, { status: 400 });
    }
    if (reviewAction !== undefined && !allowedReviewActions.includes(reviewAction)) {
      return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
    }

    const now = new Date();

    // 1. Email check
    let finalEmail = "";
    if (employee.userId) {
      const user = await User.findById(employee.userId);
      if (user) {
        if (email && email.trim()) {
          const emailLower = email.trim().toLowerCase();
          const existingUser = await User.findOne({
            email: emailLower,
            _id: { $ne: employee.userId },
          });
          if (existingUser) {
            return NextResponse.json(
              { error: "This email is already in use by another account" },
              { status: 400 }
            );
          }
          user.email = emailLower;
          await user.save();
          finalEmail = emailLower;
        } else {
          finalEmail = user.email || "";
        }
      }
    }

    // 2. Profile updates & JoinDate validation
    employee.name = typeof name === "string" && name.trim() ? name.trim() : employee.name;
    employee.designation =
      typeof designation === "string" && designation.trim()
        ? designation.trim()
        : employee.designation || employee.jobTitle || "";

    let joinDateUpdated = false;
    const originalJoinDate = employee.joinDate ? new Date(employee.joinDate) : null;
    let parsedJoinDate = originalJoinDate ? new Date(originalJoinDate) : new Date();

    if (joinDate !== undefined) {
      parsedJoinDate = new Date(joinDate);
      if (Number.isNaN(parsedJoinDate.getTime()) || parsedJoinDate > now) {
        return NextResponse.json(
          { error: "Join date must be a valid date that is not in the future" },
          { status: 400 }
        );
      }
      employee.joinDate = parsedJoinDate;
      employee.periodStartDate = parsedJoinDate;
      joinDateUpdated = true;
    }

    // Check same-day join date rule for Permanent
    const targetType = employmentType || employee.employmentType;
    const isJoinDateToday =
      parsedJoinDate.getUTCFullYear() === now.getUTCFullYear() &&
      parsedJoinDate.getUTCMonth() === now.getUTCMonth() &&
      parsedJoinDate.getUTCDate() === now.getUTCDate();

    if (isJoinDateToday && targetType === "Permanent") {
      return NextResponse.json(
        {
          error:
            "Employees joining today cannot be set as Permanent. Please select Probation, Internship, or Contract.",
        },
        { status: 400 }
      );
    }

    const lifecycleEmploymentTypes = ["Internship", "Probation"];
    const lifecycleDurationChanged = durationMonths !== undefined;
    const requestedDuration = lifecycleDurationChanged ? Number(durationMonths) : undefined;
    if (
      (lifecycleDurationChanged || joinDateUpdated) &&
      lifecycleEmploymentTypes.includes(targetType) &&
      (requestedDuration !== undefined &&
        (!Number.isInteger(requestedDuration) || ![1, 2, 3, 6].includes(requestedDuration)))
    ) {
      return NextResponse.json(
        { error: "Duration must be 1, 2, 3, or 6 months." },
        { status: 400 }
      );
    }

    // 3. Salary & Hourly Rate
    if (salary === "" || salary === null || salary === undefined) {
      employee.set("salary", null);
      employee.set("hourlyRate", null);
      employee.markModified("salary");
      employee.markModified("hourlyRate");
    } else {
      const salaryNumber = Number(salary);
      if (!Number.isNaN(salaryNumber)) {
        employee.set("salary", salaryNumber);

        let standardHours = 160;
        try {
          const company = await CompanyDetails.findOne();
          if (company && company.standardWorkingHours && company.standardWorkingHours > 0) {
            standardHours = company.standardWorkingHours;
          }
        } catch (err) {
          console.warn("Unable to fetch Company Details, using fallback 160:", err);
        }

        employee.set("hourlyRate", salaryNumber / standardHours);
        employee.markModified("salary");
        employee.markModified("hourlyRate");
      }
    }

    employee.jobTitle = employee.designation;
    employee.department = department || employee.department;
    employee.status = status || employee.status;

    if (
      employmentType &&
      employmentType !== employee.employmentType &&
      reviewAction !== "CONFIRM"
    ) {
      return NextResponse.json(
        { error: "Employment type changes must be completed through the review action." },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // 4. RECALCULATE TIMELINE IF JOIN DATE OR DURATION CHANGED (Strictly from joinDate)
    // -------------------------------------------------------------------------
    if (
      (joinDateUpdated || durationMonths !== undefined) &&
      lifecycleEmploymentTypes.includes(employee.employmentType) &&
      reviewAction !== "EXTEND" &&
      reviewAction !== "CONFIRM"
    ) {
      const months = requestedDuration ?? employee.lifecycleDurationMonths ?? 3;
      const calculatedEnd = new Date(parsedJoinDate);
      calculatedEnd.setMonth(calculatedEnd.getMonth() + months);

      employee.periodEndDate = calculatedEnd;
      employee.nextReviewDate = calculatedEnd;
      employee.lifecycleDurationMonths = months;

      if (employee.employmentType === "Probation") {
        employee.probationStartDate = parsedJoinDate;
        employee.probationEndDate = calculatedEnd;
      } else {
        employee.internshipStartDate = parsedJoinDate;
        employee.internshipEndDate = calculatedEnd;
      }

      // Check if period already passed
      if (calculatedEnd.getTime() <= now.getTime()) {
        employee.reviewStatus = "Due Review";
      } else {
        employee.reviewStatus = "Pending";
      }

      employee.markModified("periodEndDate");
      employee.markModified("nextReviewDate");
    } else if (
      (joinDateUpdated || durationMonths !== undefined) &&
      !lifecycleEmploymentTypes.includes(employee.employmentType) &&
      reviewAction !== "CONFIRM"
    ) {
      employee.periodStartDate = parsedJoinDate;
      employee.periodEndDate = null;
      employee.nextReviewDate = null;
      employee.lifecycleDurationMonths = null;
      employee.reviewStatus = "Completed";
      employee.probationStartDate = null;
      employee.probationEndDate = null;
      employee.internshipStartDate = null;
      employee.internshipEndDate = null;
    }

    // -------------------------------------------------------------------------
    // 5. REVIEW ACTIONS: EXTEND / CONFIRM
    // -------------------------------------------------------------------------
    const originalJoinKey = originalJoinDate ? originalJoinDate.toISOString().slice(0, 10) : "";
    const nextJoinKey = parsedJoinDate.toISOString().slice(0, 10);
    const joinActuallyChanged = originalJoinKey !== nextJoinKey;
    const durationActuallyChanged =
      requestedDuration !== undefined &&
      employee.lifecycleDurationMonths != null &&
      Number(requestedDuration) !== Number(employee.lifecycleDurationMonths);
    const scheduleChanged = joinActuallyChanged || durationActuallyChanged;
    const periodIsDue = isEmploymentPeriodDue(
      {
        employmentType: employee.employmentType,
        reviewStatus: scheduleChanged ? "Pending" : employee.reviewStatus,
        joinDate: parsedJoinDate,
        lifecycleDurationMonths: requestedDuration ?? employee.lifecycleDurationMonths ?? null,
        periodEndDate: scheduleChanged ? null : employee.periodEndDate,
        probationEndDate: scheduleChanged ? null : employee.probationEndDate,
        internshipEndDate: scheduleChanged ? null : employee.internshipEndDate,
      },
      now
    );

    if (reviewAction === "EXTEND") {
      const duration = Number(extendMonths);
      if (
        !Number.isInteger(duration) ||
        ![1, 2, 3].includes(duration) ||
        !["Probation", "Internship"].includes(employee.employmentType) ||
        !periodIsDue
      ) {
        return NextResponse.json(
          { error: "Only a due probation or internship can be extended by 1, 2, or 3 months." },
          { status: 400 }
        );
      }

      const trimmedReason = typeof extensionReason === "string" ? extensionReason.trim() : "";
      if (!trimmedReason) {
        return NextResponse.json(
          { error: "A reason is mandatory when extending an employee." },
          { status: 400 }
        );
      }

      const resolvedPeriod = effectiveEmploymentPeriod(
        {
          employmentType: employee.employmentType,
          reviewStatus: employee.reviewStatus,
          joinDate: parsedJoinDate,
          lifecycleDurationMonths: requestedDuration ?? employee.lifecycleDurationMonths ?? null,
          periodEndDate: employee.periodEndDate,
          probationEndDate: employee.probationEndDate,
          internshipEndDate: employee.internshipEndDate,
        },
        now
      );
      const rawCurrentEnd = resolvedPeriod.periodEndDate;
      const baseEndDate = rawCurrentEnd ? new Date(rawCurrentEnd) : new Date(parsedJoinDate);

      // If the base date was historically far back, base from today; otherwise add to base end date
      const effectiveBase =
        baseEndDate.getTime() < now.getTime() ? now : new Date(baseEndDate);

      const newEndDate = new Date(effectiveBase);
      newEndDate.setMonth(newEndDate.getMonth() + duration);

      const extensionEntry = {
        type: employee.employmentType,
        stage: employee.employmentType,
        previousEndDate: baseEndDate,
        newEndDate: newEndDate,
        durationMonths: duration,
        reason: trimmedReason,
        extendedBy: admin.id,
        extendedAt: new Date(),
      };

      if (!Array.isArray(employee.extensions)) employee.extensions = [];
      employee.extensions.push(extensionEntry);

      if (employee.employmentType === "Probation" && Array.isArray(employee.probationExtensions)) {
        employee.probationExtensions.push(extensionEntry);
      }
      if (employee.employmentType === "Internship" && Array.isArray(employee.internshipExtensions)) {
        employee.internshipExtensions.push(extensionEntry);
      }

      employee.periodEndDate = newEndDate;
      employee.nextReviewDate = newEndDate;
      employee.lifecycleDurationMonths = (employee.lifecycleDurationMonths || 0) + duration;

      if (employee.employmentType === "Probation") employee.probationEndDate = newEndDate;
      if (employee.employmentType === "Internship") employee.internshipEndDate = newEndDate;

      employee.reviewStatus = "Pending";

      employee.markModified("extensions");
      employee.markModified("periodEndDate");
      employee.markModified("nextReviewDate");
    } else if (reviewAction === "CONFIRM") {
      if (!["Probation", "Internship"].includes(employee.employmentType) || !periodIsDue) {
        return NextResponse.json(
          { error: "Only a due probation or internship can be confirmed as permanent." },
          { status: 400 }
        );
      }

      const resolvedPeriod = effectiveEmploymentPeriod(
        {
          employmentType: employee.employmentType,
          reviewStatus: employee.reviewStatus,
          joinDate: parsedJoinDate,
          lifecycleDurationMonths: requestedDuration ?? employee.lifecycleDurationMonths ?? null,
          periodEndDate: employee.periodEndDate,
          probationEndDate: employee.probationEndDate,
          internshipEndDate: employee.internshipEndDate,
        },
        now
      );
      if (!employee.periodEndDate && resolvedPeriod.periodEndDate) {
        employee.periodEndDate = resolvedPeriod.periodEndDate;
        employee.nextReviewDate = resolvedPeriod.periodEndDate;
        employee.lifecycleDurationMonths = resolvedPeriod.durationMonths;
        if (employee.employmentType === "Probation") {
          employee.probationEndDate = resolvedPeriod.periodEndDate;
        }
        if (employee.employmentType === "Internship") {
          employee.internshipEndDate = resolvedPeriod.periodEndDate;
        }
      }

      employee.employmentType = "Permanent";
      employee.confirmationDate = new Date();
      employee.reviewStatus = "Completed";
      employee.nextReviewDate = null;

      if (confirmationReason && typeof confirmationReason === "string") {
        if (!Array.isArray(employee.extensions)) employee.extensions = [];
        employee.extensions.push({
          type: "Permanent Confirmation",
          stage: "Permanent",
          previousEndDate: employee.periodEndDate || new Date(),
          newEndDate: new Date(),
          durationMonths: 0,
          reason: confirmationReason.trim(),
          extendedBy: admin.id,
          extendedAt: new Date(),
        });
        employee.markModified("extensions");
      }
    }

    await employee.save();

    // Keep the persisted balance aligned with the joining month. This also
    // materializes balances for legacy employees when they become Permanent.
    if (employee.userId && employee.joinDate) {
      try {
        await applyEmployeeLeaveProration(
          employee.userId.toString(),
          new Date(employee.joinDate)
        );
      } catch (prorationError) {
        console.error("Leave balance synchronization error on update:", prorationError);
      }
    }

    // 6. Department Head Cleanup
    if (employee.userId) {
      if (employee.status === "Inactive") {
        await DepartmentHead.deleteMany({ userId: employee.userId });
      } else {
        await DepartmentHead.deleteMany({
          userId: employee.userId,
          department: { $ne: employee.department },
        });
      }
    }

    const updatedEmployee = {
      id: employee._id.toString(),
      name: employee.name,
      role: employee.designation ?? employee.jobTitle,
      email: finalEmail,
      department: employee.department,
      status: employee.status,
      designation: employee.designation,
      joinDate: employee.joinDate ? employee.joinDate.toISOString() : undefined,
      salary: typeof employee.salary === "number" ? employee.salary : undefined,
      hourlyRate: typeof employee.hourlyRate === "number" ? employee.hourlyRate : undefined,
      employmentType: employee.employmentType,
      reviewStatus: employee.reviewStatus,
      periodStartDate: employee.periodStartDate
        ? employee.periodStartDate.toISOString()
        : null,
      periodEndDate: employee.periodEndDate ? employee.periodEndDate.toISOString() : null,
      nextReviewDate: employee.nextReviewDate ? employee.nextReviewDate.toISOString() : null,
      lifecycleDurationMonths: employee.lifecycleDurationMonths ?? null,
      confirmationDate: employee.confirmationDate ? employee.confirmationDate.toISOString() : null,
      extensions: employee.extensions || [],
    };

    return NextResponse.json({
      message: "Employee profile updated successfully",
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;

    const employee = await Employee.findById(id);
    if (!employee) {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
    }

    if (employee.userId) {
      await User.findByIdAndDelete(employee.userId);
      await DepartmentHead.deleteMany({ userId: employee.userId });
    }

    await Employee.findByIdAndDelete(id);

    return NextResponse.json({
      message: "Employee profile and system credentials deleted successfully",
    });
  } catch (error) {
    console.error("Profile deletion error:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}