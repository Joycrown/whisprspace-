import { NextRequest, NextResponse } from 'next/server'
import { SupportedCurrency, SUPPORTED_CURRENCIES } from '@/lib/payments/currency'
import { convertWithLiveRate } from '@/lib/payments/flutterwave-rates'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const currency = searchParams.get('currency') as SupportedCurrency | null
  const amountParam = searchParams.get('amount')

  if (!currency || !Object.values(SUPPORTED_CURRENCIES).includes(currency)) {
    return NextResponse.json({ error: 'Invalid or missing currency' }, { status: 400 })
  }

  const amount = amountParam ? parseFloat(amountParam) : 1
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Flutterwave not configured' }, { status: 500 })
  }

  const { amount: convertedAmount, rate } = await convertWithLiveRate(secretKey, amount, currency)

  // Cache for 5 minutes at the CDN/browser layer — matches the server-side cache TTL
  return new NextResponse(
    JSON.stringify({ currency, amount, convertedAmount, rate }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    }
  )
}
