/**
 * WhisprSpace — Volunteer Onboarding Emails
 * Uses Brevo (Sendinblue) Transactional Email API
 *
 * Two templates:
 *   A) SMM_TEMPLATE — picked for the role applied for (Social Media Manager)
 *   B) CM_TEMPLATE  — placed as Community Member
 *
 * Usage (test send only, hardcoded to whisprspaceofficial@gmail.com):
 *   node scripts/send-onboarding-emails.js
 *
 * Dry run (no emails sent, just prints):
 *   DRY_RUN=true node scripts/send-onboarding-emails.js
 *
 * To send the real batch later: replace TEST_RECIPIENTS with the real
 * SMM_RECIPIENTS / CM_RECIPIENTS lists and change the send loop below.
 */

require('dotenv').config({ path: '.env.local' })
const https = require('https')

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const API_KEY = process.env.BREVO_TRANSACTIONAL_API_KEY
const SENDER_EMAIL = process.env.EMAIL_SENDER || 'admin@whisprspace.com'
const SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'WhisprSpace'
const DRY_RUN = process.env.DRY_RUN === 'true'
const DELAY_MS = 200

const ONBOARDING_DAY = 'Thursday, October 1st'

// ─────────────────────────────────────────────
//  TEST RECIPIENTS
// ─────────────────────────────────────────────
const TEST_RECIPIENTS = [
  { email: 'joycrowntech@gmail.com', name: 'Test', template: 'smm' },
  { email: 'joycrowntech@gmail.com', name: 'Test', template: 'cm' },
]

// ─────────────────────────────────────────────
//  REAL RECIPIENTS
// ─────────────────────────────────────────────
const SMM_RECIPIENTS = [
  { email: 'yusufkehinde8@gmail.com', name: 'Kehinde Yusuf' },
  { email: 'patiseh4@gmail.com', name: 'Patience Moses' },
  { email: 'oadebola645@gmail.com', name: 'Adebola Olaniyan' },
  { email: 'itunuoluwapurpose@gmail.com', name: 'Deborah Ojo' },
  { email: 'imogoreprecious@gmail.com', name: 'Imogore Precious' },
  { email: 'ifeoluwaolaonipekun221@gmail.com', name: 'Ifeoluwa Olaonipekun' },
  { email: 'digitalworks234@gmail.com', name: 'Owais Shaikh' },
  { email: 'gj997046@gmail.com', name: 'Gift James' },
  { email: 'ayonitemibakare20@gmail.com', name: 'Ayonitemi Bakare' },
  { email: 'lightimm087@gmail.com', name: 'Ihechi Immaculate' },
  { email: 'olaniyanayoade999@gmail.com', name: 'Olaniyan Ayoade' },
].map((r) => ({ ...r, template: 'smm' }))

const CM_RECIPIENTS = [
  { email: 'igweflorenceukoha@gmail.com', name: 'Florence Chinanu' },
  { email: 'chiomacamilla12@gmail.com', name: 'Esomonu Camilla Chioma' },
  { email: 'goodnesseshua@gmail.com', name: 'Goodness' },
  { email: 'edgarosayande1@gmail.com', name: 'Edgar Osayande' },
  { email: 'balogunhalimat81@gmail.com', name: 'Halimat Balogun' },
  { email: 'chychyokeke30@gmail.com', name: 'Esther Okeke' },
  { email: 'usermonday7@gmail.com', name: 'Treasure Joshua' },
  { email: 'owojuabisola@gmail.com', name: 'Abisola Owoju' },
  { email: 'kennyolajiggs@gmail.com', name: 'Kehinde Olajiga' },
].map((r) => ({ ...r, template: 'cm' }))

// ─────────────────────────────────────────────
//  SHARED EMAIL SHELL
// ─────────────────────────────────────────────
function buildShell({ preheader, eyebrow, headline, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>WhisprSpace</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d12;">
<tr>
  <td align="center" style="padding:40px 16px 48px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

      <!-- NAV BAR -->
      <tr>
        <td style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                <img src="https://app.whisprspace.com/assets/ws-icon.png" width="28" height="28" alt="" style="display:block;border-radius:6px;" />
              </td>
              <td style="vertical-align:middle;">
                <span style="font-size:15px;font-weight:700;letter-spacing:0.04em;color:#ffffff;">WhisprSpace</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- HERO CARD -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e1333 0%,#16112b 50%,#0f1a2e 100%);border-radius:20px;overflow:hidden;padding:0;">
          <div style="height:3px;background:linear-gradient(90deg,#a855f7,#6366f1,#3b82f6);"></div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:44px 40px 4px;">
                <p style="margin:0 0 18px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#a78bfa;">
                  ${eyebrow}
                </p>
                <h1 style="margin:0 0 4px;font-size:28px;font-weight:800;line-height:1.3;letter-spacing:-0.02em;color:#ffffff;">
                  ${headline}
                </h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- SPACER -->
      <tr><td style="height:12px;"></td></tr>

      <!-- BODY CARD -->
      <tr>
        <td style="background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:36px 40px;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- SPACER -->
      <tr><td style="height:32px;"></td></tr>

      <!-- FOOTER -->
      <tr>
        <td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <span style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:#94a3b8;">WhisprSpace</span>
              </td>
              <td align="right">
                <a href="https://whisprspace.com/privacy-policy" style="font-size:11px;color:#64748b;text-decoration:none;">Privacy Policy</a>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:8px;">
                <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;">
                  You're receiving this because you applied to volunteer with WhisprSpace.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td>
</tr>
</table>

</body>
</html>`
}

// ─────────────────────────────────────────────
//  TEMPLATE A — Picked for Social Media Manager
// ─────────────────────────────────────────────
function buildSmmHtml(recipient) {
  const firstName = recipient.name ? recipient.name.split(' ')[0] : null
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#cbd5e1;">
      ${greeting}
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Thank you for applying for the Social Media Team volunteer role at WhisprSpace. After reviewing your
      application, we're pleased to confirm that you have been selected to be part of this team.
    </p>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#cbd5e1;">
      We were impressed by your experience and the ideas you shared, and we're looking forward to having you
      on the team.
    </p>

    <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(129,140,248,0.25);border-radius:12px;padding:20px 24px;margin:0 0 28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#a78bfa;">Onboarding</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${ONBOARDING_DAY}</p>
      <p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
        Further details (time and link/venue) will follow in a separate email ahead of the session.
      </p>
    </div>

    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Before then, do well to follow us on all our social media platforms and engage with us — tag and mention
      <span style="color:#c084fc;font-weight:600;">@whisprspace</span> so we can connect with you.
    </p>

    <p style="margin:0;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Congratulations again, and welcome to WhisprSpace.
    </p>
    <p style="margin:20px 0 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Best,<br/>The WhisprSpace Team
    </p>
  `

  return buildShell({
    preheader: 'You’ve been selected for WhisprSpace’s Social Media Team.',
    eyebrow: 'Application update',
    headline: 'You’ve been selected — Social Media Team',
    bodyHtml,
  })
}

// ─────────────────────────────────────────────
//  TEMPLATE B — Placed as Community Member
// ─────────────────────────────────────────────
function buildCmHtml(recipient) {
  const firstName = recipient.name ? recipient.name.split(' ')[0] : null
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#cbd5e1;">
      ${greeting}
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Thank you for applying to volunteer with WhisprSpace. After reviewing your application, we're excited to
      welcome you as a Community Member.
    </p>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Community members are a core part of how WhisprSpace grows, and we're glad to have you with us.
    </p>

    <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(129,140,248,0.25);border-radius:12px;padding:20px 24px;margin:0 0 28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#a78bfa;">What's next</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${ONBOARDING_DAY}</p>
      <p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
        The link to join the community will be sent in a follow-up email on this date.
      </p>
    </div>

    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Before then, do well to follow us on all our social media platforms and engage with us — tag and mention
      <span style="color:#c084fc;font-weight:600;">@whisprspace</span> so we can connect with you.
    </p>

    <p style="margin:0;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Welcome to WhisprSpace — we're looking forward to having you with us.
    </p>
    <p style="margin:20px 0 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
      Best,<br/>The WhisprSpace Team
    </p>
  `

  return buildShell({
    preheader: 'You’ve been welcomed to the WhisprSpace community as a Community Member.',
    eyebrow: 'Application update',
    headline: 'Welcome to WhisprSpace — Community Member',
    bodyHtml,
  })
}

const SUBJECTS = {
  smm: 'You’re in — WhisprSpace Social Media Team',
  cm: 'You’re in — WhisprSpace Community Member',
}

function buildHtml(recipient) {
  return recipient.template === 'cm' ? buildCmHtml(recipient) : buildSmmHtml(recipient)
}

// ─────────────────────────────────────────────
//  BREVO API CALL
// ─────────────────────────────────────────────
function sendEmail(recipient) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [recipient.name ? { email: recipient.email, name: recipient.name } : { email: recipient.email }],
      subject: SUBJECTS[recipient.template],
      htmlContent: buildHtml(recipient),
    })

    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, messageId: JSON.parse(data).messageId })
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────
// SEND_MODE: 'test' (default) | 'smm' | 'cm' | 'all'
const SEND_MODE = process.env.SEND_MODE || 'test'

function getRecipients(mode) {
  if (mode === 'smm') return SMM_RECIPIENTS
  if (mode === 'cm') return CM_RECIPIENTS
  if (mode === 'all') return [...SMM_RECIPIENTS, ...CM_RECIPIENTS]
  return TEST_RECIPIENTS
}

async function main() {
  if (!API_KEY && !DRY_RUN) {
    console.error('❌  BREVO_TRANSACTIONAL_API_KEY is not set in .env.local')
    process.exit(1)
  }

  const recipients = getRecipients(SEND_MODE)

  console.log(`\n📧  WhisprSpace Onboarding Emails (${SEND_MODE.toUpperCase()})`)
  console.log(`    From:       ${SENDER_NAME} <${SENDER_EMAIL}>`)
  console.log(`    Recipients: ${recipients.length}`)
  console.log(`    Mode:       ${DRY_RUN ? '🧪 DRY RUN (no emails sent)' : '🚀 LIVE'}`)
  console.log(`─────────────────────────────────────────`)

  let sent = 0
  let failed = 0

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i]
    const label = `[${i + 1}/${recipients.length}] ${recipient.email} (${recipient.template})`

    if (DRY_RUN) {
      console.log(`  ✓ DRY  ${label}`)
      sent++
      continue
    }

    try {
      const result = await sendEmail(recipient)
      console.log(`  ✓ SENT ${label}  (id: ${result.messageId})`)
      sent++
    } catch (err) {
      console.error(`  ✗ FAIL ${label}  → ${err.message}`)
      failed++
    }

    if (i < recipients.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`─────────────────────────────────────────`)
  console.log(`  Sent: ${sent}  |  Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = { buildSmmHtml, buildCmHtml, SUBJECTS }
