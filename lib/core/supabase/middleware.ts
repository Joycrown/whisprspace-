import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // SDK Middleware disabled for raw-auth migration
  return NextResponse.next({
    request,
  })
}
