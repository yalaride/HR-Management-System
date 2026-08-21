export type EmailSendResult = {
  ok: boolean;
  error?: string;
};

/** Normalize Resend / unknown errors into a short audit-friendly message. */
export function formatEmailError(error: unknown, fallback = "Email delivery failed"): string {
  if (!error) return fallback;

  if (typeof error === "string" && error.trim()) {
    return truncate(error.trim(), 280);
  }

  if (error instanceof Error && error.message.trim()) {
    return truncate(error.message.trim(), 280);
  }

  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const message =
      (typeof obj.message === "string" && obj.message) ||
      (typeof obj.error === "string" && obj.error) ||
      (typeof obj.name === "string" && obj.name) ||
      "";
    const statusCode =
      typeof obj.statusCode === "number"
        ? obj.statusCode
        : typeof obj.status === "number"
          ? obj.status
          : null;

    const parts = [message, statusCode != null ? `(HTTP ${statusCode})` : ""].filter(Boolean);
    if (parts.length > 0) return truncate(parts.join(" "), 280);

    try {
      return truncate(JSON.stringify(error), 280);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
