import { AccessCode } from '@/types';

/**
 * Generate a random access code (e.g., "COLLAB2024ABC")
 */
export function generateAccessCode(): string {
  const prefix = ['EARLY', 'COLLAB', 'VIP', 'BETA', 'TEAM', 'PARTNER'][Math.floor(Math.random() * 6)];
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${year}${random}`;
}

/**
 * Generate a secret token for URL-based access
 */
export function generateSecretToken(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Create a new access code object
 */
export function createAccessCode(maxUses: number, expiryDays?: number): AccessCode {
  const code = generateAccessCode();
  const createdAt = new Date().toISOString();
  const expiresAt = expiryDays 
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  return {
    code,
    maxUses,
    currentUses: 0,
    expiresAt,
    createdAt,
    isActive: true,
  };
}

/**
 * Validate an access code
 */
export function validateAccessCode(
  code: string,
  accessCodes: AccessCode[]
): { valid: boolean; accessCode?: AccessCode } {
  const foundCode = accessCodes.find(ac => ac.code === code.toUpperCase());

  if (!foundCode) {
    return { valid: false };
  }

  // Check if code is active
  if (!foundCode.isActive) {
    return { valid: false };
  }

  // Check if code has uses remaining
  if (foundCode.currentUses >= foundCode.maxUses) {
    return { valid: false };
  }

  // Check if code is expired
  if (foundCode.expiresAt && new Date(foundCode.expiresAt) < new Date()) {
    return { valid: false };
  }

  return { valid: true, accessCode: foundCode };
}

/**
 * Increment code usage count
 */
export function incrementCodeUsage(accessCodes: AccessCode[], code: string): AccessCode[] {
  return accessCodes.map(ac => {
    if (ac.code === code) {
      return {
        ...ac,
        currentUses: ac.currentUses + 1,
        // Deactivate if max uses reached
        isActive: ac.currentUses + 1 < ac.maxUses,
      };
    }
    return ac;
  });
}

/**
 * Check if a secret token matches
 */
export function validateSecretToken(token: string | undefined, providedToken: string): boolean {
  if (!token || !providedToken) return false;
  return token === providedToken;
}

/**
 * Extract access token from URL
 */
export function getAccessTokenFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('access');
  } catch {
    return null;
  }
}
