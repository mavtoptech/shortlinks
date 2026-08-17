import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/auth/session'

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Protect /dashboard routes
  const user = await getSessionUserFromRequest(request);

  if (pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // Redirect authenticated users away from sign-in/sign-up
  if (request.method === 'GET' && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Handle aliases
  if (pathname === '/login') return NextResponse.redirect(new URL('/sign-in', request.url));
  if (pathname === '/register' || pathname === '/signup') return NextResponse.redirect(new URL('/sign-up', request.url));

  return NextResponse.next({ request });
}
