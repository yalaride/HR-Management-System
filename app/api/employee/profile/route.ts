import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Employee } from "@/modals/Employee"; // Preserving exact model path
import { cloudinary, ensureCloudinaryConfigured } from "@/lib/cloudinary";
import { getProfileCompletion } from "@/lib/profile-completion";

/**
 * Utility to extract Cloudinary's public_id from a full URL
 * Example: https://res.cloudinary.com/cloud_name/image/upload/v12345/folder/sample.jpg -> folder/sample
 */
function extractPublicIdFromUrl(url: string): string | null {
  try {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    // Get the segment of the URL after "/upload/"
    const afterUpload = url.substring(uploadIndex + 8);

    // Remove the version segment (e.g. "v1234567/") if it exists
    const cleanedPath = afterUpload.replace(/^v\d+\//, "");

    // Find the last dot to strip the file extension (e.g., .jpg, .png)
    const lastDotIndex = cleanedPath.lastIndexOf(".");
    if (lastDotIndex === -1) return cleanedPath;

    return cleanedPath.substring(0, lastDotIndex);
  } catch (error) {
    console.error("Error extracting public ID from Cloudinary URL:", error);
    return null;
  }
}

export async function GET() {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    interface LeanEmployeeProfile {
      fullName?: string;
      name?: string;
      profilePhotoUrl?: string;
      phoneNumber?: string;
      address?: string;
      dateOfBirth?: Date | null;
      gender?: string;
      maritalStatus?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      updatedAt?: Date;
    }
    const employee = (await Employee.findOne({ userId }).lean()) as LeanEmployeeProfile | null;

    if (!employee) {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        fullName: employee.fullName || employee.name || "",
        email: session?.user?.email || "",

        // UI Editable properties
        profilePhotoUrl: employee.profilePhotoUrl || "",
        phoneNumber: employee.phoneNumber || "",
        address: employee.address || "",
        dateOfBirth: employee.dateOfBirth
          ? (() => {
              const d = employee.dateOfBirth as Date;
              return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            })()
          : "",
        gender: employee.gender || "",
        maritalStatus: employee.maritalStatus || "",
        emergencyContactName: employee.emergencyContactName || "",
        emergencyContactPhone: employee.emergencyContactPhone || "",

        updatedAt: employee.updatedAt,
        ...(() => {
          const completion = getProfileCompletion({
            profilePhotoUrl: employee.profilePhotoUrl,
            phoneNumber: employee.phoneNumber,
            address: employee.address,
            dateOfBirth: employee.dateOfBirth,
            gender: employee.gender,
            maritalStatus: employee.maritalStatus,
            emergencyContactName: employee.emergencyContactName,
            emergencyContactPhone: employee.emergencyContactPhone,
          });
          return {
            completionPercent: completion.percent,
            missingFields: completion.missingFields,
            profileComplete: completion.complete,
          };
        })(),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: "Internal Server Error", details: message || String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      profilePhotoUrl,
      phoneNumber,
      address,
      dateOfBirth,
      gender,
      maritalStatus,
      emergencyContactName,
      emergencyContactPhone,
    } = body || {};

    let employee = await Employee.findOne({ userId });
    if (!employee) {
      const fallbackName = session?.user?.name || session?.user?.email || "Employee";
      employee = await Employee.create({
        userId,
        name: fallbackName,
        designation: "",
        joinDate: new Date(),
        department: "General",
        salary: 0,
        status: "Active",
        fullName: fallbackName,
      });
    }

    // Explicit type verification safety checks
    if (phoneNumber !== undefined && typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "phoneNumber must be a string" }, { status: 400 });
    }

    // --- CLOUDINARY CLEANUP & DB STATE RESOLUTION ---
    const oldPhotoUrl = employee.profilePhotoUrl;

    if (profilePhotoUrl !== undefined) {
      // If profilePhotoUrl is null, empty, or not a string, normalize it to an empty string
      const normalizedNewPhotoUrl = typeof profilePhotoUrl === "string" ? profilePhotoUrl.trim() : "";

      // If an old image existed and the new URL is different (meaning the image is being replaced or removed)
      if (oldPhotoUrl && oldPhotoUrl !== normalizedNewPhotoUrl) {
        const publicId = extractPublicIdFromUrl(oldPhotoUrl);
        if (publicId) {
          try {
            ensureCloudinaryConfigured();
            await cloudinary.uploader.destroy(publicId);
          } catch (cloudinaryError) {
            // Logs error if Cloudinary fails, but doesn't halt the DB update to prevent stuck states
            console.error("Cloudinary asset deletion failed:", cloudinaryError);
          }
        }
      }

      employee.profilePhotoUrl = normalizedNewPhotoUrl;
    }

    employee.phoneNumber = typeof phoneNumber === "string" ? phoneNumber.trim() : employee.phoneNumber;
    employee.address = typeof address === "string" ? address.trim() : employee.address;

    if (typeof dateOfBirth === "string" && dateOfBirth) {
      // Store calendar DOB at UTC noon so month/day never shift across timezones
      const { parseCalendarDateToUtcNoon } = await import("@/lib/birthday-date");
      const parsed = parseCalendarDateToUtcNoon(dateOfBirth);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid dateOfBirth" }, { status: 400 });
      }
      employee.dateOfBirth = parsed;
    } else if (dateOfBirth === "" || dateOfBirth === null) {
      employee.dateOfBirth = null;
    }

    employee.gender = typeof gender === "string" ? gender : employee.gender;
    employee.maritalStatus = typeof maritalStatus === "string" ? maritalStatus : employee.maritalStatus;

    employee.emergencyContactName = typeof emergencyContactName === "string" ? emergencyContactName.trim() : employee.emergencyContactName;
    employee.emergencyContactPhone = typeof emergencyContactPhone === "string" ? emergencyContactPhone.trim() : employee.emergencyContactPhone;

    await employee.save();

    return NextResponse.json(
      {
        message: "Profile updated successfully",
        profilePhotoUrl: employee.profilePhotoUrl || "",
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: "Internal Server Error", details: message || String(error) },
      { status: 500 }
    );
  }
}