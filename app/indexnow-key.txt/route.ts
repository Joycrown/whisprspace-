import { NextResponse } from 'next/server';

export function GET() {
  const indexNowKey = process.env.INDEXNOW_KEY?.trim();

  if (!indexNowKey) {
    return new NextResponse('IndexNow key not configured.', { status: 404 });
  }

  return new NextResponse(`${indexNowKey}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
