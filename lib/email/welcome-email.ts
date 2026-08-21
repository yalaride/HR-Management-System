import { resend } from "@/lib/resend";
import { getResendFromAddress, isResendConfigured } from "@/lib/email/config";
import { EmailSendResult, formatEmailError } from "@/lib/email/send-result";

function getWelcomeEmailTemplate(name: string, email: string, temporaryPassword: string): string {
  const portalUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const currentYear = new Date().getFullYear();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to the Team</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600px" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <tr>
                <td style="background-color: #2563eb; padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Welcome to the Team!</h1>
                  <p style="color: #dbeafe; margin: 8px 0 0 0; font-size: 14px;">Your official workspace account has been configured.</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0f172a; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <strong>${name}</strong>,</p>
                  <p style="color: #475569; font-size: 14px; line-height: 22px; margin: 0 0 24px 0;">
                    We are thrilled to welcome you. Your official profile is registered in our directories. Below are your temporary credentials to log in and access your workspace dashboard.
                  </p>
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; margin-bottom: 28px; border: 1px solid #e2e8f0;">
                    <tr>
                      <td style="padding: 20px;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="8">
                          <tr>
                            <td width="35%" style="color: #94a3b8; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Portal URL</td>
                            <td width="65%" style="color: #0f172a; font-size: 14px; font-weight: 600; padding-bottom: 4px;">
                              <a href="${portalUrl}" style="color: #2563eb; text-decoration: none;">Go to Portal</a>
                            </td>
                          </tr>
                          <tr>
                            <td style="color: #94a3b8; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; padding-top: 4px; padding-bottom: 4px;">Username</td>
                            <td style="color: #0f172a; font-size: 14px; font-weight: 600; padding-top: 4px; padding-bottom: 4px;">${email}</td>
                          </tr>
                          <tr>
                            <td style="color: #94a3b8; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; padding-top: 4px;">Temp Password</td>
                            <td style="color: #2563eb; font-size: 14px; font-weight: 700; font-family: Courier, monospace; letter-spacing: 0.05em; padding-top: 4px;">${temporaryPassword}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px; text-align: center;">
                    <tr>
                      <td align="center">
                        <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);">
                          Log In to Workspace
                        </a>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                    <tr>
                      <td>
                        <p style="color: #2563eb; font-size: 13px; line-height: 20px; font-weight: 600; margin: 0 0 6px 0;">🔑 Security Protocol:</p>
                        <p style="color: #475569; font-size: 13px; line-height: 20px; margin: 0;">
                          This temporary password is only valid for your initial log in. For data protection compliance, please set a new personalized password immediately upon accessing your account dashboard.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="color: #94a3b8; font-size: 11px; line-height: 18px; margin: 0 0 4px 0;">This email is auto-generated by your internal HR platform. Please do not reply directly to this message.</p>
                  <p style="color: #94a3b8; font-size: 11px; line-height: 18px; margin: 0;">&copy; ${currentYear} Internal Corporate Directory.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendWelcomeEmail(
  name: string,
  email: string,
  tempPassword: string
): Promise<EmailSendResult> {
  if (!isResendConfigured()) {
    const error = "RESEND_API_KEY is missing — welcome email skipped";
    console.error(error);
    return { ok: false, error };
  }

  try {
    const htmlContent = getWelcomeEmailTemplate(name, email, tempPassword);

    const emailResponse = await resend.emails.send({
      from: getResendFromAddress(),
      to: [email],
      subject: "Welcome to the Team - Your Workspace Account Credentials",
      html: htmlContent,
    });

    if (emailResponse.error) {
      const error = formatEmailError(emailResponse.error, "Resend welcome delivery failed");
      console.error("Resend onboarding delivery failed:", emailResponse.error);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    const message = formatEmailError(error, "Unexpected welcome email error");
    console.error("An unexpected error occurred during email delivery:", error);
    return { ok: false, error: message };
  }
}