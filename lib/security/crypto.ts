import crypto from 'crypto'

export const safeCompare = (a: string, b: string): boolean => {
  if (!a || !b) return false

  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false

  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

export const sha256Hex = (payload: string): string =>
  crypto.createHash('sha256').update(payload).digest('hex')
