import { NextRequest, NextResponse } from 'next/server'
import { sanitizeSingleLineInput } from '@/lib/security/input-sanitization'

const BREVO_API_KEY =
  process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY || ''
const SUPPORT_INBOX = 'support@whisprspace.com'
const SENDER_EMAIL = process.env.EMAIL_SENDER || 'admin@whisprspace.com'
const SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'WhisprSpace'

// 5 MB per file, max 3 files, 10 MB total
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_FILES = 3
const MAX_TOTAL_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm',
]

export async function POST(req: NextRequest) {
  // Accept multipart/form-data so files can be included
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name    = sanitizeSingleLineInput(String(formData.get('name')    || ''), { maxLength: 80 }).trim()
  const email   = sanitizeSingleLineInput(String(formData.get('email')   || ''), { maxLength: 120 }).trim()
  const message = String(formData.get('message') || '').slice(0, 2000).trim()

  if (!message || message.length < 10) {
    return NextResponse.json({ error: 'Message is too short.' }, { status: 400 })
  }
  if (!BREVO_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured.' }, { status: 500 })
  }

  // Process attachments
  const files = formData.getAll('attachments') as File[]
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} attachments allowed.` }, { status: 400 })
  }

  let totalBytes = 0
  const attachments: { name: string; content: string; type: string }[] = []

  for (const file of files) {
    if (!file || !file.size) continue
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type ${file.type} is not allowed.` }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `Each file must be under 5 MB.` }, { status: 400 })
    }
    totalBytes += file.size
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: 'Total attachment size must be under 10 MB.' }, { status: 400 })
    }
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    attachments.push({ name: file.name, content: base64, type: file.type })
  }

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#7c3aed;margin-bottom:16px">New Support Request</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
        <tr><td style="padding:6px 0;color:#888;width:80px">From:</td><td style="padding:6px 0;font-weight:600">${name || '(no name)'}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Email:</td><td style="padding:6px 0">${email || '(not provided)'}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Files:</td><td style="padding:6px 0">${attachments.length > 0 ? attachments.map(a => a.name).join(', ') : 'None'}</td></tr>
      </table>
      <div style="background:#f5f5f5;border-left:4px solid #7c3aed;padding:16px;border-radius:4px;white-space:pre-wrap;font-size:14px;line-height:1.6">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
  `

  const payload: Record<string, unknown> = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: SUPPORT_INBOX, name: 'WhisprSpace Support' }],
    subject: `Support: ${name || 'Anonymous'} — ${message.slice(0, 60)}`,
    htmlContent: htmlBody,
  }
  if (email) payload.replyTo = { email, name: name || email }
  if (attachments.length > 0) {
    payload.attachment = attachments.map(a => ({
      name: a.name,
      content: a.content,
    }))
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[support/contact] Brevo error:', err)
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
