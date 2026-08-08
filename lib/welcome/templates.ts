export function buildInboxMessageContent(inboxUrl: string, gettingStartedUrl: string): string {
  return `Welcome to WhisprSpace! 👋

You're in — a space where you can speak freely, ask honestly, and stay completely anonymous.

Here's what to try right now:

📬 Share your inbox link
Let anyone send you anonymous messages — one-off drops or full back-and-forth conversations. Copy your link and share it anywhere:
${inboxUrl}

💬 Start a thread
Got a question you're scared to ask out loud, a rant, or something you need real opinions on? Drop it as a thread, share the link, and people respond anonymously. No names, no filters.

✨ Go Premium
Create premium threads and earn from every person who joins. Your content, your rules.

Want to see everything step by step?
${gettingStartedUrl}

Glad you're here.
— WhisprSpace Team`
}

export function buildWelcomeEmailHtml(inboxUrl: string, gettingStartedUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to WhisprSpace</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f3f4f6; padding-bottom: 40px; }
    .main-table { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; font-family: sans-serif; color: #1f2937; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #f97316 100%); padding: 32px 0; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .content { padding: 40px; }
    .feature-block { background: #f9fafb; border-left: 3px solid #8b5cf6; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .feature-block.orange { border-left-color: #f97316; }
    .feature-block.green { border-left-color: #10b981; }
    .feature-block h3 { margin: 0 0 6px; font-size: 15px; color: #111827; }
    .feature-block p { margin: 0 0 10px; font-size: 14px; color: #4b5563; line-height: 1.5; }
    .button { display: inline-block; padding: 12px 28px; background: linear-gradient(to right, #8b5cf6, #f97316); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .link-pill { display: inline-block; background: #ede9fe; color: #6d28d9; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-family: monospace; word-break: break-all; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 28px 0; }
    .footer { padding: 0 40px 32px; text-align: center; font-size: 12px; color: #6b7280; }
    @media screen and (max-width: 600px) {
      .content { padding: 28px 20px; }
      .button { width: 100%; box-sizing: border-box; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <center>
      <div style="height:40px"></div>
      <table class="main-table" role="presentation">
        <tr>
          <td class="header">
            <h1>WhisprSpace</h1>
            <p>Speak freely, stay hidden</p>
          </td>
        </tr>
        <tr>
          <td class="content">
            <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">You're in. Welcome.</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
              This is your space to say what's really on your mind — no names, no judgement, no filters.
              Here's what to do first.
            </p>

            <div class="feature-block">
              <h3>📬 Share your inbox link</h3>
              <p>Let anyone send you anonymous messages — a one-off drop or a full back-and-forth conversation. Share it anywhere.</p>
              <span class="link-pill">${inboxUrl}</span>
              <div style="margin-top:14px">
                <a href="${inboxUrl}" class="button">Open my inbox</a>
              </div>
            </div>

            <div class="feature-block orange">
              <h3>💬 Start a thread</h3>
              <p>Got a question, a rant, or something you need real opinions on? Drop it as a thread, share the link, and people respond anonymously.</p>
            </div>

            <div class="feature-block green">
              <h3>✨ Go Premium &amp; Earn</h3>
              <p>Create premium threads that people pay to join. You set the access fee — we handle the rest. Your voice, your income.</p>
            </div>

            <div class="divider"></div>

            <p style="margin:0 0 16px;font-size:14px;color:#6b7280;text-align:center;">
              New here? See everything step by step.
            </p>
            <div style="text-align:center">
              <a href="${gettingStartedUrl}" class="button">How WhisprSpace works →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td class="footer">
            <p style="margin:0">&copy; ${new Date().getFullYear()} WhisprSpace. All rights reserved.</p>
            <p style="margin:8px 0 0">Speak freely, stay hidden.</p>
          </td>
        </tr>
      </table>
      <div style="height:40px"></div>
    </center>
  </div>
</body>
</html>`
}
