import { NextResponse } from 'next/server';
import {
  escapeHtml,
  sanitizeEmailAddress,
  sanitizeHttpUrl,
  sanitizeSingleLineInput,
} from '@/lib/security/input-sanitization';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const email = sanitizeEmailAddress((body as Record<string, unknown>).email);
    const inviteUrl = sanitizeHttpUrl((body as Record<string, unknown>).inviteUrl, {
      maxLength: 2048,
    });
    const threadTitle = sanitizeSingleLineInput((body as Record<string, unknown>).threadTitle, {
      maxLength: 120,
    });

    if (!email || !inviteUrl) {
      return NextResponse.json({ error: 'Email and invite link are required' }, { status: 400 });
    }

    const safeThreadTitle = threadTitle || 'a private discussion';
    const safeThreadTitleHtml = escapeHtml(safeThreadTitle);
    const safeInviteUrlHtml = escapeHtml(inviteUrl);

    const brevoApiKey = process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY;
    if (!brevoApiKey) {
      console.error('Brevo API Key missing');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const subject = `You\u2019re invited to "${safeThreadTitle}"`;

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
              name: process.env.EMAIL_SENDER_NAME || 'WhisprSpace',
              email: process.env.EMAIL_SENDER || 'admin@whisprspace.com',
        },
        to: [{ email }],
        subject,
        htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discussion Invite</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f3f4f6; padding-bottom: 40px; }
    .main-table { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); padding: 32px 0; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 36px 40px; }
    .button-container { text-align: center; margin: 28px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(to right, #8b5cf6, #f97316); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.25); }
    .footer { padding: 0 40px 32px; text-align: center; font-size: 12px; color: #6b7280; }
    .link-text { color: #8b5cf6; word-break: break-all; font-size: 13px; }
    @media screen and (max-width: 600px) {
      .content { padding: 32px 24px; }
      .button { width: 100%; box-sizing: border-box; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <center>
      <div style="height: 40px;"></div>
      <table class="main-table" role="presentation">
        <tr>
          <td class="header">
            <h1>WhisprSpace</h1>
          </td>
        </tr>
        <tr>
          <td class="content">
            <h2 style="margin: 0 0 16px; font-size: 22px; color: #111827;">Discussion Invitation</h2>
            <p style="margin: 0 0 18px; line-height: 1.6; font-size: 16px; color: #4b5563;">
              You have been invited to join "${safeThreadTitleHtml}".
            </p>
            <div class="button-container">
              <a href="${safeInviteUrlHtml}" class="button">Join Discussion</a>
            </div>
            <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #6b7280;">
              If the button does not work, copy and paste this link into your browser:
            </p>
            <p class="link-text">${safeInviteUrlHtml}</p>
          </td>
        </tr>
        <tr>
          <td class="footer">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} WhisprSpace. All rights reserved.</p>
            <p style="margin: 8px 0 0;">Speak freely, stay hidden.</p>
          </td>
        </tr>
      </table>
      <div style="height: 40px;"></div>
    </center>
  </div>
</body>
</html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}));
      console.error('Brevo API Error:', errorData);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send invite email error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
