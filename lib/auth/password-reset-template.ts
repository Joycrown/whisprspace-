/**
 * Generates the HTML content for the password reset email.
 * @param resetLink - The unique password reset link for the user.
 * @returns The full HTML string for the email.
 */
export const getPasswordResetHtml = (resetLink: string): string => {
  const currentYear = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhisprSpace Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7; color: #333;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 20px 20px 20px; border-bottom: 1px solid #eeeeee;">
              <h1 style="margin: 0; font-size: 28px; color: #2c3e50; font-weight: 600;">WhisprSpace</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #34495e; font-weight: 500;">Password Reset Request</h2>
              <p style="margin: 0 0 25px 0; font-size: 16px; color: #555555; line-height: 1.6;">We received a request to reset the password associated with this email address. If you made this request, please click the button below to set a new password.</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="${resetLink}" target="_blank" style="background-color: #3498db; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">Reset Your Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 25px 0; font-size: 16px; color: #555555; line-height: 1.6;">This password reset link is valid for 1 hour.</p>
              <p style="margin: 0; font-size: 16px; color: #555555; line-height: 1.6;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 30px; background-color: #f9f9f9; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; font-size: 12px; color: #999999;">&copy; ${currentYear} WhisprSpace. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
