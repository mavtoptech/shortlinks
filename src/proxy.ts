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
    // 3. Find the URL in the database using admin client to bypass RLS restrictions on custom_domains table for anonymous visitors
    const supabaseAdmin = createAdminClient();
    const { data: link, error } = await supabaseAdmin
      .from('short_urls')
      .select(`
        *,
        custom_domains (
          domain
        )
      `)
      .eq('short_code', slug)
      .single();

    if (error || !link) {
      const res = NextResponse.rewrite(new URL('/not-found', request.url));
      res.headers.set('x-debug-error', JSON.stringify(error || 'link-null'));
      res.headers.set('x-debug-slug', slug);
      res.headers.set('x-debug-url', process.env.NEXT_PUBLIC_SUPABASE_URL || 'FALLBACK_USED');
      const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      res.headers.set('x-debug-key-prefix', key ? key.slice(0, 35) + '...' : 'EMPTY_KEY');
      return res;
    }

    // 4. Asynchronously increment clicks without blocking the redirect!
    event.waitUntil(
      Promise.resolve(
        supabaseAdmin
          .from('short_urls')
          .update({ clicks_count: (link.clicks_count || 0) + 1 })
          .eq('id', link.id)
          .then(({ error }: any) => {
            if (error) console.error('Failed to increment clicks:', error);
          })
      )
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
