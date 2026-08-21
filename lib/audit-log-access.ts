/**
 * Hard-coded + env allowlist for employees who may view the full company
 * activity/audit feed on the employee portal.
 *
 * No admin UI exposes this — change emails via code default or
 * AUDIT_LOG_VIEWER_EMAILS env (comma-separated).
 */
const DEFAULT_AUDIT_VIEWER_EMAILS = ["ubaidullah2305@gmail.com"];

export function getAuditLogViewerEmails(): string[] {
  const fromEnv = (process.env.AUDIT_LOG_VIEWER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const merged = new Set<string>([
    ...DEFAULT_AUDIT_VIEWER_EMAILS.map((e) => e.toLowerCase()),
    ...fromEnv,
  ]);

  return Array.from(merged);
}

export function canViewFullAuditLogs(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return getAuditLogViewerEmails().includes(email.trim().toLowerCase());
}
