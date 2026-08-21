import connectDB from "@/lib/mongodb";
import { ActivityLog } from "@/modals/ActivityLog";
import { getKarachiDateParts } from "@/lib/birthday-date";

type EmailIssueKind =
  | "birthday"
  | "birthday_admin"
  | "welcome"
  | "password_reset"
  | "system";

/**
 * Writes a visible operational failure into Activity Logs so issues
 * (especially Resend) can be diagnosed from the audit feed.
 */
export async function logEmailIssue(params: {
  userId: string;
  kind: EmailIssueKind;
  subjectLabel: string;
  emailAddress?: string | null;
  reason: string;
  status?: "Failed" | "Skipped";
}): Promise<void> {
  try {
    await connectDB();
    const { dateStr } = getKarachiDateParts(new Date());
    const status = params.status || "Failed";
    const to = params.emailAddress?.trim();
    const reason = params.reason.trim() || "Unknown error";

    const prefix =
      params.kind === "birthday"
        ? "Birthday email"
        : params.kind === "birthday_admin"
          ? "Admin birthday alert email"
          : params.kind === "welcome"
            ? "Welcome email"
            : params.kind === "password_reset"
              ? "Password reset email"
              : "Email";

    const description = to
      ? `${prefix} ${status.toLowerCase()} for ${params.subjectLabel} (${to}). Reason: ${reason}`
      : `${prefix} ${status.toLowerCase()} for ${params.subjectLabel}. Reason: ${reason}`;

    await ActivityLog.create({
      userId: params.userId,
      activityType: "EMAIL_FAILED",
      date: dateStr,
      timestamp: new Date(),
      description,
      metadata: {
        status,
        emailAddress: to || undefined,
        errorMessage: reason,
        emailKind: params.kind,
      },
    });
  } catch (err) {
    console.error("Failed to write email issue to ActivityLog:", err);
  }
}
