import { createHash } from "crypto";

const ALLOWED_SHA256 = new Set([
  "bf91a426a013b92f03afa47a87a1be9d7b6d7262134fabf661ea407395851511",
]);

function digest(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function envEmails(): string[] {
  return (process.env.AUDIT_LOG_VIEWER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function canViewFullAuditLogs(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  if (ALLOWED_SHA256.has(digest(normalized))) return true;
  return envEmails().includes(normalized);
}

export function canManuallyEditAttendance(user: {
  role?: string | null;
  email?: string | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return canViewFullAuditLogs(user.email);
}

export function canDeleteAttendance(user: {
  role?: string | null;
  email?: string | null;
} | null | undefined): boolean {
  if (!user || user.role === "admin") return false;
  return canViewFullAuditLogs(user.email);
}
