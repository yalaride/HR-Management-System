import { NextResponse } from "next/server";
import CompanyDetails from "@/modals/CompanyDetails";
import { DepartmentHead } from "@/modals/DepartmentHead";
import dbConnect from "@/lib/mongodb";
import { getAdminUser } from "@/lib/auth";

// 1. Prevent Next.js from caching GET requests statically
export const dynamic = "force-dynamic";

// GET: Retrieve company settings safely
export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await dbConnect();
    
    let settings = await CompanyDetails.findOne();
    
    if (!settings) {
      settings = {
        companyName: "",
        location: "",
        phone: "",
        email: "",
        standardWorkingHours: 160,
        departments: [],
        shiftStart: "09:00",
        shiftEnd: "17:00",
        gracePeriod: 15,
        checkInDisplayBefore: 30,
        checkOutDisplayAfter: 0,
        autoCheckOut: false,
        payslipHeadName: "",
        payslipHeadTitle: "Authorized Signatory",
        payslipSignatureUrl: "",
        payslipStampUrl: "",
        companyLogoUrl: "",
        companyLogoScale: 1,
        companyLogoOffsetX: 0,
        companyLogoOffsetY: 0,
      };
    }

    return NextResponse.json(settings);
  } catch (error: unknown) {
    console.error("GET API Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Internal Server Error: " + errorMessage },
      { status: 500 }
    );
  }
}

// Unified Update Handler (Shared by PUT and POST methods)
async function handleUpdate(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    await dbConnect();

    // 2. Safely parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format or empty request payload." },
        { status: 400 }
      );
    }

    const { 
      companyName, 
      location, 
      phone, 
      email, 
      standardWorkingHours,
      departments,
      shiftStart,
      shiftEnd,
      gracePeriod,
      checkInDisplayBefore,
      checkOutDisplayAfter,
      autoCheckOut,
      payslipHeadName,
      payslipHeadTitle,
      payslipSignatureUrl,
      payslipStampUrl,
      companyLogoUrl,
      companyLogoScale,
      companyLogoOffsetX,
      companyLogoOffsetY,
    } = body;

    // Find the singular active settings document
    const existing = await CompanyDetails.findOne();

    // Map fields carefully and apply fallback defaults (preserve payslip branding
    // when a partial settings update omits those keys).
    const payload = {
      companyName: companyName ?? existing?.companyName ?? "",
      location: location ?? existing?.location ?? "",
      phone: phone ?? existing?.phone ?? "",
      email: email ?? existing?.email ?? "",
      standardWorkingHours:
        typeof standardWorkingHours === "number"
          ? standardWorkingHours
          : (existing?.standardWorkingHours ?? 160),
      departments: Array.isArray(departments) ? departments : (existing?.departments ?? []),
      shiftStart: shiftStart || existing?.shiftStart || "09:00",
      shiftEnd: shiftEnd || existing?.shiftEnd || "17:00",
      gracePeriod:
        typeof gracePeriod === "number" ? gracePeriod : (existing?.gracePeriod ?? 15),
      checkInDisplayBefore:
        typeof checkInDisplayBefore === "number"
          ? checkInDisplayBefore
          : (existing?.checkInDisplayBefore ?? 30),
      checkOutDisplayAfter:
        typeof checkOutDisplayAfter === "number"
          ? checkOutDisplayAfter
          : (existing?.checkOutDisplayAfter ?? 0),
      autoCheckOut:
        typeof autoCheckOut === "boolean" ? autoCheckOut : (existing?.autoCheckOut ?? false),
      payslipHeadName:
        typeof payslipHeadName === "string"
          ? payslipHeadName.trim()
          : (existing?.payslipHeadName ?? ""),
      payslipHeadTitle:
        typeof payslipHeadTitle === "string"
          ? payslipHeadTitle.trim()
          : (existing?.payslipHeadTitle ?? "Authorized Signatory"),
      payslipSignatureUrl:
        typeof payslipSignatureUrl === "string"
          ? payslipSignatureUrl.trim()
          : (existing?.payslipSignatureUrl ?? ""),
      payslipStampUrl:
        typeof payslipStampUrl === "string"
          ? payslipStampUrl.trim()
          : (existing?.payslipStampUrl ?? ""),
      companyLogoUrl:
        typeof companyLogoUrl === "string"
          ? companyLogoUrl.trim()
          : (existing?.companyLogoUrl ?? ""),
      companyLogoScale:
        typeof companyLogoScale === "number"
          ? Math.min(3, Math.max(0.5, companyLogoScale))
          : (existing?.companyLogoScale ?? 1),
      companyLogoOffsetX:
        typeof companyLogoOffsetX === "number"
          ? Math.min(80, Math.max(-80, companyLogoOffsetX))
          : (existing?.companyLogoOffsetX ?? 0),
      companyLogoOffsetY:
        typeof companyLogoOffsetY === "number"
          ? Math.min(40, Math.max(-40, companyLogoOffsetY))
          : (existing?.companyLogoOffsetY ?? 0),
    };

    let result;
    if (!existing) {
      // Create if first time
      result = await CompanyDetails.create(payload);
    } else {
      // Update the existing document
      result = await CompanyDetails.findByIdAndUpdate(
        existing._id,
        payload,
        { new: true, runValidators: true }
      );
    }

    // Deleted departments must not keep orphaned head assignments
    await DepartmentHead.deleteMany({ department: { $nin: payload.departments } });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Write API Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to persist database changes: " + errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  return handleUpdate(request);
}

export async function POST(request: Request) {
  return handleUpdate(request);
}