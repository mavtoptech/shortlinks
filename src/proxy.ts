// Next.js 16.3 proxy middleware v1.0.2
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  // 1. Check if pathname is a system/app route
  const isSystemRoute =
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/email') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/trpc') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/signup';

  const slug = pathname.substring(1);

  // 2. If it's a potential short link (e.g. /YeJlnQ), attempt direct link resolution BEFORE auth session overhead
  if (!isSystemRoute && slug && !slug.includes('/')) {
    try {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk';
      const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0';
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.mavtop.in';

      // Query short_urls using ANON_KEY first
      let dbRes = await fetch(`${supabaseUrl}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*,custom_domains(domain)`, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!dbRes.ok) {
        // Fallback to SERVICE_KEY
        dbRes = await fetch(`${supabaseUrl}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*,custom_domains(domain)`, {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Accept': 'application/json',
          },
          cache: 'no-store',
        });
      }

      if (dbRes.ok) {
        const links = await dbRes.json();
        const link = Array.isArray(links) ? links[0] : null;

        if (link && link.original_url) {
          // Asynchronously increment clicks
          event.waitUntil(
            fetch(`${supabaseUrl}/rest/v1/short_urls?id=eq.${link.id}`, {
              method: 'PATCH',
              headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({ clicks_count: (link.clicks_count || 0) + 1 }),
            }).catch((e) => console.error('Click count increment failed:', e))
          );

          // Perform immediate redirect
          return NextResponse.redirect(link.original_url);
        }
      }
    } catch (error: any) {
      console.error("Proxy Shortlink Error:", error);
    }

    // If shortlink was not found, return 404
    return NextResponse.rewrite(new URL('/not-found', request.url));
  }

  // 3. For system/app routes, update auth session
  const { response } = await updateSession(request);
  return response;
}
