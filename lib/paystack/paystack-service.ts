import { supabase } from '@/lib/core/supabase/client'

/**
 * Initialize Paystack payment
 */
export const initializePaystackPayment = async (
  threadId: string,
  country: string
): Promise<{ authorization_url: string | null; reference: string | null; error: string | null }> => {
  try {
    // Call our API route to initialize Paystack payment
    const response = await fetch('/api/paystack/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        threadId,
        country,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      const message = error?.error || error?.message || 'Failed to initialize payment'
      return { authorization_url: null, reference: null, error: message }
    }

    const { authorization_url, reference } = await response.json()
    return { authorization_url, reference, error: null }
  } catch (error) {
    console.error('Initialize Paystack payment error:', error)
    return { authorization_url: null, reference: null, error: 'An unexpected error occurred' }
  }
}

/**
 * Verify Paystack payment
 */
export const verifyPaystackPayment = async (
  reference: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const response = await fetch(`/api/paystack/verify?reference=${reference}`)

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message || 'Verification failed' }
    }

    const { status } = await response.json()
    return { success: status === 'success', error: null }
  } catch (error) {
    console.error('Verify Paystack payment error:', error)
    return { success: false, error: 'Verification failed' }
  }
}

/**
 * Check if user has purchased a thread (same as Stripe)
 */
export const hasThreadAccess = async (
  threadId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('thread_purchases')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return false
      throw error
    }

    return !!data
  } catch (error) {
    console.error('Check thread access error:', error)
    return false
  }
}

/**
 * Get supported Paystack currencies
 */
export const getPaystackCurrency = (userCountry: string): string => {
  const currencyMap: Record<string, string> = {
    NG: 'NGN', // Nigeria
    GH: 'GHS', // Ghana
    ZA: 'ZAR', // South Africa
    KE: 'KES', // Kenya
  }

  return currencyMap[userCountry] || 'NGN' // Default to NGN
}

/**
 * Convert USD to local currency (rough estimates)
 */
export const convertUsdToLocal = (usdAmount: number, currency: string): number => {
  const conversionRates: Record<string, number> = {
    NGN: 1550, // 1 USD = ~1550 NGN
    GHS: 15.5, // 1 USD = ~15.5 GHS
    ZAR: 18.5, // 1 USD = ~18.5 ZAR
    KES: 155,  // 1 USD = ~155 KES
  }

  const rate = conversionRates[currency] || 1
  return Math.round(usdAmount * rate)
}

/**
 * Detect if user is from Africa (for gateway selection)
 */
export const isAfricanCountry = (countryCode: string): boolean => {
  const africanCountries = ['NG', 'GH', 'ZA', 'KE']
  return africanCountries.includes(countryCode.toUpperCase())
}

/**
 * Get user's country code (from browser or IP)
 */
export const getUserCountry = async (): Promise<string> => {
  try {
    // Try to get from browser's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    // Map common African timezones
    const timezoneMap: Record<string, string> = {
      'Africa/Lagos': 'NG',
      'Africa/Accra': 'GH',
      'Africa/Johannesburg': 'ZA',
      'Africa/Nairobi': 'KE',
    }

    if (timezone && timezoneMap[timezone]) {
      return timezoneMap[timezone]
    }

    // Fallback: Try IP-based geolocation (free service)
    const response = await fetch('https://ipapi.co/json/')
    const data = await response.json()
    return data.country_code || 'US'
  } catch (error) {
    console.error('Get user country error:', error)
    return 'US' // Default to US
  }
}
