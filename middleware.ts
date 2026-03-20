import { NextResponse, type NextRequest } from 'next/server'

// 12:00 noon WAT (UTC+1) on 20 March 2026 = 11:00 UTC
const LAUNCH_TIME = new Date('2026-03-20T11:00:00.000Z').getTime()

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always pass through static assets, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/avatars') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next()
  }

  const launched = Date.now() >= LAUNCH_TIME

  if (!launched) {
    // Lock every route to /launch
    if (pathname !== '/launch') {
      return NextResponse.redirect(new URL('/launch', request.url))
    }
  } else {
    // After launch, redirect /launch back to home
    if (pathname === '/launch') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
