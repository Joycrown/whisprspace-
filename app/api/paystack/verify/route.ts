import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: 'Paystack is not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')

    if (!reference) {
      return NextResponse.json(
        { error: 'Missing payment reference' },
        { status: 400 }
      )
    }

    // Verify transaction with Paystack
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 500 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      status: data.data.status,
      amount: data.data.amount / 100, // Convert from kobo
      reference: data.data.reference,
      metadata: data.data.metadata,
    })
  } catch (error) {
    console.error('Paystack verify error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
