import { resend } from "@/lib/resend";
import { getResendFromAddress, isResendConfigured } from "@/lib/email/config";
import { EmailSendResult, formatEmailError } from "@/lib/email/send-result";
import { formatHolidayDate } from "@/lib/holiday-announcement";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface HolidayEmailContent {
  title: string;
  startDate: string;
  endDate: string;
  resumeLabel: string;
  announcement: string;
}

function letterParagraphs(announcement: string): string[] {
  return announcement
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => {
          const plain = line.replace(/^📢\s*/, "");
          return plain.length > 0 && !/^(holiday announcement\b|to:|regards,?$|sync up management$)/i.test(plain);
        })
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

export function holidayEmailHtml(content: HolidayEmailContent): string {
  const title = content.title.trim() || "Public Holiday";
  const sameDay = content.startDate === content.endDate;
  const when = sameDay
    ? formatHolidayDate(content.startDate)
    : `${formatHolidayDate(content.startDate)} – ${formatHolidayDate(content.endDate)}`;
  const paragraphs = letterParagraphs(content.announcement)
    .map(
      (block) =>
        `<p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:24px;">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Holiday Announcement – ${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:#1d4ed8;padding:28px 32px 24px 32px;">
              <p style="margin:0 0 8px 0;color:#dbeafe;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Sync Up</p>
              <h1 style="margin:0;color:#ffffff;font-size:26px;line-height:32px;font-weight:800;">Holiday Announcement</h1>
              <p style="margin:8px 0 0 0;color:#eff6ff;font-size:18px;font-weight:700;">${escapeHtml(title)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0 32px;">
              <p style="margin:20px 0 0 0;color:#64748b;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">To: All Departments</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #dbeafe;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px 0;color:#1d4ed8;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Office closed</p>
                    <p style="margin:0;color:#0f172a;font-size:16px;line-height:24px;font-weight:800;">${escapeHtml(when)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px 0;color:#64748b;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Work resumes</p>
                    <p style="margin:0;color:#0f172a;font-size:15px;line-height:22px;font-weight:700;">${escapeHtml(content.resumeLabel)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              ${paragraphs}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px 32px;">
              <p style="margin:0;color:#0f172a;font-size:14px;line-height:22px;">Regards,</p>
              <p style="margin:2px 0 0 0;color:#1d4ed8;font-size:14px;line-height:22px;font-weight:800;">Sync Up Management</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:11px;line-height:18px;">This announcement was sent by Sync Up HR.</p>
              <p style="margin:2px 0 0 0;color:#94a3b8;font-size:11px;">&copy; ${year} Sync Up</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendHolidayEmail(
  email: string,
  subject: string,
  content: HolidayEmailContent
): Promise<EmailSendResult> {
  if (!isResendConfigured()) {
    return { ok: false, error: "RESEND_API_KEY is missing — holiday email skipped" };
  }

  try {
    const emailResponse = await resend.emails.send({
      from: getResendFromAddress(),
      to: [email],
      subject,
      html: holidayEmailHtml(content),
    });
    if (emailResponse.error) {
      return { ok: false, error: formatEmailError(emailResponse.error, "Holiday email failed") };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatEmailError(error, "Holiday email failed") };
  }
}
