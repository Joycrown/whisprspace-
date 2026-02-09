export const getUserCountry = async (): Promise<string> => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    const timezoneMap: Record<string, string> = {
      'Africa/Lagos': 'NG',
      'Africa/Accra': 'GH',
      'Africa/Johannesburg': 'ZA',
      'Africa/Nairobi': 'KE',
    }

    if (timezone && timezoneMap[timezone]) {
      return timezoneMap[timezone]
    }

    const response = await fetch('https://ipapi.co/json/')
    const data = await response.json()
    return data.country_code || 'US'
  } catch (error) {
    console.error('Get user country error:', error)
    return 'US'
  }
}
