export const createThreadPurchaseSession = async (
  threadId: string,
  country?: string
): Promise<{ url: string | null; error: string | null }> => {
  try {
    const response = await fetch('/api/flutterwave/initialize', {
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
      const message = error?.error || error?.message || 'Failed to create checkout session'
      return { url: null, error: message }
    }

    const { url } = await response.json()
    return { url, error: null }
  } catch (error) {
    console.error('Create Flutterwave checkout error:', error)
    return { url: null, error: 'An unexpected error occurred' }
  }
}
