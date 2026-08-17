// Next.js 16.3 proxy middleware v1.0.1
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createAdminClient } from '@/utils/supabase/admin'

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Update session handles the /dashboard protection and redirecting authenticated users away from /sign-in
  const { response, supabase } = await updateSession(request)

  if (!supabase) {
    // This happens if we hit a redirect case in updateSession
    return response;
  }

  const url = request.nextUrl;
  // Extract domain from x-forwarded-host or host header, stripping ports and commas
  const rawHostname = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const hostname = rawHostname.split(',')[0].split(':')[0].trim();
  const pathname = url.pathname;

  // 1. Skip system routes for link resolution
  if (
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
    pathname.startsWith('/trpc')
  ) {
    return response;
  }

  // 2. We have a potential short link! (e.g. /abc123)
  // Extract the slug (remove leading slash)
  const slug = pathname.substring(1);

  // If the slug contains another slash, it's not a standard shortlink, let Next.js handle it
  if (slug.includes('/')) {
    return response;
  }

  try {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk';
    const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.mavtop.in';

    // 3. Query short_urls using ANON_KEY first (short_urls table has public read access)
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

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      const res = NextResponse.rewrite(new URL('/not-found', request.url));
      res.headers.set('x-debug-error', `HTTP ${dbRes.status}: ${errText}`);
      res.headers.set('x-debug-slug', slug);
      return res;
    }

    const links = await dbRes.json();
    const link = Array.isArray(links) ? links[0] : null;

    if (!link || !link.original_url) {
      const res = NextResponse.rewrite(new URL('/not-found', request.url));
      res.headers.set('x-debug-error', 'link-not-found');
      res.headers.set('x-debug-slug', slug);
      return res;
    }

    // 4. Asynchronously increment clicks without blocking the redirect!
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

    // 5. Perform the redirect
    const redirectRes = NextResponse.redirect(link.original_url);
    redirectRes.headers.set('x-debug-found', link.short_code);
    return redirectRes;

  } catch (error: any) {
    console.error("Proxy DB Error:", error);
    const errRes = NextResponse.rewrite(new URL('/not-found', request.url));
    errRes.headers.set('x-debug-exception', error?.message || String(error));
    return errRes;
  }
}
