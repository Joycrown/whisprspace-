
export type SupportedCurrency = 'USD' | 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'UGX' | 'TZS' | 'RWF'

export const SUPPORTED_CURRENCIES: Record<string, SupportedCurrency> = {
  US: 'USD',
  NG: 'NGN',
  GH: 'GHS',
  KE: 'KES',
  ZA: 'ZAR',
  UG: 'UGX',
  TZ: 'TZS',
  RW: 'RWF',
}

// Static exchange rates relative to 1 USD
// These should ideally be fetched from an API in a real production environment
// but static rates are acceptable for this implementation phase.
// Last updated: Feb 2026
const EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  USD: 1,
  NGN: 1500, // Nigerian Naira
  GHS: 15.5, // Ghanaian Cedi
  KES: 160,  // Kenyan Shilling
  ZAR: 19,   // South African Rand
  UGX: 3800, // Ugandan Shilling
  TZS: 2550, // Tanzanian Shilling
  RWF: 1280, // Rwandan Franc
}

export const getCurrencyForCountry = (countryCode: string): SupportedCurrency => {
  return SUPPORTED_CURRENCIES[countryCode] || 'USD'
}

export const convertPrice = (amountInUsd: number, targetCurrency: SupportedCurrency): number => {
  const rate = EXCHANGE_RATES[targetCurrency] || 1
  return Math.ceil(amountInUsd * rate)
}

export const formatCurrency = (amount: number, currency: SupportedCurrency): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}
