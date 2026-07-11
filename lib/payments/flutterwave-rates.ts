import { SupportedCurrency } from './currency'

// ─── Static fallback rates (Feb 2026) ────────────────────────────────────────
// Used only when the Flutterwave /rates API is unreachable.
// Do not use these for display — they are a last-resort fallback only.
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1,
  NGN: 1500,
  GHS: 15.5,
  KES: 160,
  ZAR: 19,
  UGX: 3800,
  TZS: 2550,
  RWF: 1280,
}

// ─── In-process rate cache ────────────────────────────────────────────────────
// Keyed by currency. Entries expire after 5 minutes so we're not calling
// Flutterwave on every paywall load while still being fresh enough to match
// the rate Flutterwave will actually apply at charge time.

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  rate: number
  fetchedAt: number
}

const rateCache = new Map<string, CacheEntry>()

function getCachedRate(currency: string): number | null {
  const entry = rateCache.get(currency)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    rateCache.delete(currency)
    return null
  }
  return entry.rate
}

function setCachedRate(currency: string, rate: number) {
  rateCache.set(currency, { rate, fetchedAt: Date.now() })
}

// ─── Core fetch ──────────────────────────────────────────────────────────────

/**
 * Fetch the live Flutterwave exchange rate for 1 USD → toCurrency.
 * Returns the fallback static rate if the API call fails.
 * Results are cached per currency for 5 minutes.
 */
export async function fetchLiveRate(
  secretKey: string,
  toCurrency: SupportedCurrency
): Promise<number> {
  if (toCurrency === 'USD') return 1

  const cached = getCachedRate(toCurrency)
  if (cached !== null) return cached

  try {
    const res = await fetch(
      `https://api.flutterwave.com/v3/rates?from=USD&to=${toCurrency}&amount=1`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        // Don't let a slow Flutterwave response block the checkout
        signal: AbortSignal.timeout(4000),
      }
    )

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const payload = await res.json()
    const rate = payload?.data?.rate

    if (typeof rate === 'number' && rate > 0) {
      setCachedRate(toCurrency, rate)
      return rate
    }

    throw new Error('Invalid rate payload')
  } catch (err) {
    console.warn(`[FLW rates] ${toCurrency} fetch failed, using fallback:`, err)
    const fallback = FALLBACK_RATES[toCurrency] ?? 1
    // Cache the fallback too so we don't hammer the API on repeated failures
    setCachedRate(toCurrency, fallback)
    return fallback
  }
}

/**
 * Convert a USD amount to the target currency using the live Flutterwave rate.
 * The returned amount is what Flutterwave will charge the buyer.
 */
export async function convertWithLiveRate(
  secretKey: string,
  amountUsd: number,
  toCurrency: SupportedCurrency
): Promise<{ amount: number; rate: number }> {
  const rate = await fetchLiveRate(secretKey, toCurrency)
  // Round up to nearest whole unit for currencies that don't use decimals
  const amount = toCurrency === 'USD'
    ? Number(amountUsd.toFixed(2))
    : Math.ceil(amountUsd * rate)
  return { amount, rate }
}
