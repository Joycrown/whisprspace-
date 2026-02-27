const LEGAL_CONSENT_STORAGE_KEY = 'whisprspace_legal_consent'

export const LEGAL_CONSENT_VERSION = '2026-02-27'

export const LEGAL_CONSENT_REQUIRED_ERROR =
  'Please review and accept the Privacy Policy and Community Guidelines before creating a guest or registered account.'

type LegalConsentRecord = {
  version: string
  acceptedAt: string
}

const canUseStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage

export const hasRequiredLegalConsent = (): boolean => {
  if (!canUseStorage()) return true

  try {
    const raw = window.localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY)
    if (!raw) return false

    const parsed = JSON.parse(raw) as Partial<LegalConsentRecord>
    return (
      parsed.version === LEGAL_CONSENT_VERSION &&
      typeof parsed.acceptedAt === 'string' &&
      parsed.acceptedAt.length > 0
    )
  } catch {
    return false
  }
}

export const recordLegalConsent = (): void => {
  if (!canUseStorage()) return

  const payload: LegalConsentRecord = {
    version: LEGAL_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(payload))
}
