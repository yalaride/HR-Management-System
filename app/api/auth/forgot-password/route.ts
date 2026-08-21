import { NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/mongodb";

import User from "@/modals/User";
import { Employee } from "@/modals/Employee";
import PasswordResetToken from "@/modals/PasswordResetToken";
import { sendPasswordResetEmail } from "@/lib/email/reset-password-email";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }

    // Identify user
    const user = await User.findOne({ email: email.toLowerCase() });

    // Mitigate account enumeration by returning 200 regardless
    if (!user) {
      return NextResponse.json(
        { message: "Recovery instructions have been sent if the email exists." },
        { status: 200 }
      );
    }

    // Try to get associated Employee record to locate their name
    const employee = await Employee.findOne({ userId: user._id });
    const displayName = employee?.name || user.name || "Employee";

    // Delete existing validation tokens
    await PasswordResetToken.deleteMany({ userId: user._id });

    // Generate random raw token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Establish TTL expiration date (1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      token: hashedToken,
      expiresAt,
    });

    // Build unique redirect destination link
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    // Dispatch via Resend
    const sent = await sendPasswordResetEmail(displayName, user.email, resetUrl);

    if (!sent.ok) {
      const { logEmailIssue } = await import("@/lib/activity-log-email");
      await logEmailIssue({
        userId: user._id.toString(),
        kind: "password_reset",
        subjectLabel: displayName,
        emailAddress: user.email,
        reason: sent.error || "Password reset email delivery failed",
        status: "Failed",
      });
      return NextResponse.json({ message: "Error routing email transmission." }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Recovery instructions have been sent if the email exists." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password reset processing error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}