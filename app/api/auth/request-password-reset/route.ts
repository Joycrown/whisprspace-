import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate recovery link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        // Redirect directly to the reset password page.
        // The project uses Implicit Grant (hash fragment), so we must handle session client-side.
        // Server-side callback route cannot see the hash.
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`,
      },
    });

    if (error) {
      console.error('Error generating recovery link via admin:', error);
      if (error.message.includes('User not found')) {
         // User not found, just return success to prevent enumeration
         return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' });
      }
      return NextResponse.json({ error: 'Failed to generate reset link' }, { status: 500 });
    }

    const resetLink = data.properties?.action_link;
    if (!resetLink) {
        return NextResponse.json({ error: 'Failed to generate reset link (no link)' }, { status: 500 });
    }

    // Send email via Brevo
    const brevoApiKey = process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY;

    if (!brevoApiKey) {
        console.error('Brevo API Key missing');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.EMAIL_SENDER_NAME || 'WhisprSpace',
          email: process.env.EMAIL_SENDER || 'admin@whisprspace.com',
        },
        to: [{ email: email }],
        subject: 'Reset Your Password - WhisprSpace',
        htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f3f4f6; padding-bottom: 40px; }
        .main-table { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; font-family: sans-serif; color: #1f2937; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .header { background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); padding: 32px 0; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
        .content { padding: 40px 40px; }
        .button-container { text-align: center; margin: 32px 0; }
        .button { display: inline-block; padding: 14px 32px; background: linear-gradient(to right, #8b5cf6, #f97316); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.25); transition: opacity 0.2s; }
        .button:hover { opacity: 0.9; }
        .divider { height: 1px; background-color: #e5e7eb; margin: 32px 0; }
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
                <!-- Header -->
                <tr>
                    <td class="header">
                        <h1>WhisprSpace</h1>
                    </td>
                </tr>

                <!-- Content -->
                <tr>
                    <td class="content">
                        <h2 style="margin: 0 0 16px; font-size: 22px; color: #111827;">Reset Your Password</h2>
                        <p style="margin: 0 0 24px; line-height: 1.6; font-size: 16px; color: #4b5563;">
                            Hello,
                        </p>
                        <p style="margin: 0 0 24px; line-height: 1.6; font-size: 16px; color: #4b5563;">
                            We received a request to reset the password for your WhisprSpace account. If you didn't make this request, check if anyone else has access to your email.
                        </p>
                        
                        <div class="button-container">
                            <a href="${resetLink}" class="button">Reset Password</a>
                        </div>
                        
                        <p style="margin: 0 0 0; line-height: 1.6; font-size: 16px; color: #4b5563;">
                            If you didn't request this, you can safely ignore this email. The link will expire in 1 hour.
                        </p>
                    </td>
                </tr>

                <!-- Footer -->
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
      const errorData = await emailResponse.json();
      console.error('Brevo API Error:', errorData);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' });

  } catch (error) {
    console.error('Request password reset API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
