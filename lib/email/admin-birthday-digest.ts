import { resend } from "@/lib/resend";
import { getResendFromAddress, isResendConfigured } from "@/lib/email/config";
import { formatEmailError } from "@/lib/email/send-result";

export interface BirthdayAdminCelebrant {
  name: string;
  email: string | null;
  designation?: string;
  department?: string;
  emailStatus: "Success" | "Failed" | "Skipped" | "AlreadySent";
  reason?: string;
}

export type AdminEmailDispatchResult = {
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
};

export function getAdminBirthdayDigestTemplate(
  dateLabel: string,
  celebrants: BirthdayAdminCelebrant[],
  dashboardUrl: string
): string {
  const currentYear = new Date().getFullYear();
  const rows = celebrants
    .map((c) => {
      const statusColor =
        c.emailStatus === "Success"
          ? "#16a34a"
          : c.emailStatus === "Failed"
            ? "#dc2626"
            : c.emailStatus === "Skipped"
              ? "#d97706"
              : "#64748b";
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">
            <strong>${c.name}</strong><br/>
            <span style="color:#64748b;font-size:11px;">${c.designation || "Team member"} · ${c.department || "General"}</span>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
            ${c.email || "—"}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; color: ${statusColor};">
            ${c.emailStatus}${c.reason ? `<br/><span style="font-weight:500;color:#94a3b8;font-size:10px;">${c.reason}</span>` : ""}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
        <tr><td align="center">
          <table width="100%" style="max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#2563eb;padding:28px 24px;">
                <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">🎂 Birthday Digest — ${dateLabel}</h1>
                <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">
                  ${celebrants.length} team member${celebrants.length === 1 ? "" : "s"} celebrating today (or catch-up window).
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                  <tr style="background:#f8fafc;">
                    <th align="left" style="padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Employee</th>
                    <th align="left" style="padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Email</th>
                    <th align="left" style="padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Wish status</th>
                  </tr>
                  ${rows}
                </table>
                <p style="margin:20px 0 0;text-align:center;">
                  <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:10px 18px;border-radius:10px;">
                    Open Birthdays in SyncUp
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;">
                <p style="margin:0;color:#94a3b8;font-size:11px;">Auto-sent by SyncUp HR · © ${currentYear}</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendAdminBirthdayDigest(
  adminEmails: string[],
  dateLabel: string,
  celebrants: BirthdayAdminCelebrant[],
  dashboardUrl: string
): Promise<AdminEmailDispatchResult> {
  if (!isResendConfigured()) {
    return {
      sent: 0,
      failed: adminEmails.length,
      failures: adminEmails.map((email) => ({
        email,
        error: "RESEND_API_KEY is missing — admin digest skipped",
      })),
    };
  }

  if (adminEmails.length === 0 || celebrants.length === 0) {
    return { sent: 0, failed: 0, failures: [] };
  }

  const html = getAdminBirthdayDigestTemplate(dateLabel, celebrants, dashboardUrl);
  let sent = 0;
  let failed = 0;
  const failures: { email: string; error: string }[] = [];

  for (const to of adminEmails) {
    try {
      const result = await resend.emails.send({
        from: getResendFromAddress(),
        to: [to],
        subject: `🎂 Birthday alert (${dateLabel}) — ${celebrants.length} celebrant(s)`,
        html,
      });
      if (result.error) {
        const error = formatEmailError(result.error, "Resend admin digest failed");
        console.error(`Admin birthday digest failed for ${to}:`, result.error);
        failed++;
        failures.push({ email: to, error });
      } else {
        sent++;
      }
    } catch (err) {
      const error = formatEmailError(err, "Unexpected admin digest error");
      console.error(`Admin birthday digest error for ${to}:`, err);
      failed++;
      failures.push({ email: to, error });
    }
  }

  return { sent, failed, failures };
}

/** Upcoming birthday reminder (tomorrow / next few days) for admins. */
export async function sendAdminUpcomingBirthdayReminder(
  adminEmails: string[],
  dateLabel: string,
  names: { name: string; department?: string; designation?: string; whenLabel: string }[],
  dashboardUrl: string
): Promise<AdminEmailDispatchResult> {
  if (!isResendConfigured()) {
    return {
      sent: 0,
      failed: adminEmails.length,
      failures: adminEmails.map((email) => ({
        email,
        error: "RESEND_API_KEY is missing — upcoming reminder skipped",
      })),
    };
  }

  if (adminEmails.length === 0 || names.length === 0) {
    return { sent: 0, failed: 0, failures: [] };
  }

  const list = names
    .map(
      (n) =>
        `<li style="margin:0 0 8px;color:#0f172a;font-size:13px;"><strong>${n.name}</strong> — ${n.whenLabel}<br/><span style="color:#64748b;font-size:11px;">${n.designation || "Team member"} · ${n.department || "General"}</span></li>`
    )
    .join("");

  const html = `
    <!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="background:#2563eb;padding:24px;color:#fff;">
          <h1 style="margin:0;font-size:18px;">Upcoming birthday reminder</h1>
          <p style="margin:6px 0 0;color:#dbeafe;font-size:13px;">As of ${dateLabel}</p>
        </div>
        <div style="padding:24px;">
          <ul style="margin:0;padding-left:18px;">${list}</ul>
          <p style="text-align:center;margin:20px 0 0;">
            <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:10px 18px;border-radius:10px;">View in SyncUp</a>
          </p>
        </div>
      </div>
    </body></html>
  `;

  let sent = 0;
  let failed = 0;
  const failures: { email: string; error: string }[] = [];

  for (const to of adminEmails) {
    try {
      const result = await resend.emails.send({
        from: getResendFromAddress(),
        to: [to],
        subject: `🎈 Upcoming birthdays — ${names.length} in the next few days`,
        html,
      });
      if (result.error) {
        const error = formatEmailError(result.error, "Resend upcoming reminder failed");
        console.error(`Upcoming birthday reminder failed for ${to}:`, result.error);
        failed++;
        failures.push({ email: to, error });
      } else {
        sent++;
      }
    } catch (err) {
      const error = formatEmailError(err, "Unexpected upcoming reminder error");
      console.error(`Upcoming birthday reminder error for ${to}:`, err);
      failed++;
      failures.push({ email: to, error });
    }
  }

  return { sent, failed, failures };
}
