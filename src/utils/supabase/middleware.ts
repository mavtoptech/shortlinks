import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEFAULT_SUPABASE_URL = "https://supabase.mavtop.in";
const DEFAULT_ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl
  const pathname = url.pathname

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      return { response: NextResponse.redirect(new URL('/sign-in', request.url)) }
    }
  }

  // Redirect authenticated users away from sign-in/sign-up (GET requests only)
  if (request.method === 'GET' && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
    if (user) {
      return { response: NextResponse.redirect(new URL('/dashboard', request.url)) }
    }
  }

  // Handle common typo routes
  if (pathname === '/login') {
    return { response: NextResponse.redirect(new URL('/sign-in', request.url)) }
  }
  if (pathname === '/register' || pathname === '/signup') {
    return { response: NextResponse.redirect(new URL('/sign-up', request.url)) }
  }

  return { response: supabaseResponse, supabase, user }
}
