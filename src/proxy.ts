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
  // Update session handles the /dashboard protection and redirecting authenticated users away from /sign-in
  const { response, supabase } = await updateSession(request)

  if (!supabase) {
    // This happens if we hit a redirect case in updateSession
    return response;
  }

  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const pathname = url.pathname;

  // 1. Skip system routes for link resolution
  if (
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
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
    // 3. Find the URL in the database
    const { data: link, error } = await supabase
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
      // Short link not found, let it fall through to a 404 page
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }

    // 4. Verify domain match
    const isDefaultDomain = !link.domain_id;
    const isMatchingCustomDomain = link.custom_domains && link.custom_domains.domain === hostname;
    
    // We'll be lenient for local testing on localhost, but in production we'd strictly enforce domain matching
    const isLocalhost = hostname.includes('localhost') || hostname.includes('192.168');
    
    if (!isDefaultDomain && !isMatchingCustomDomain && !isLocalhost) {
      // The short link exists, but it belongs to a different custom domain!
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }

    // 5. Asynchronously increment clicks without blocking the redirect!
    // Since we enabled RLS, we need to bypass it for this update or use a database function
    // For now, we'll execute an RPC or just an update since we made an RLS policy allowing public update
    event.waitUntil(
      Promise.resolve(
        supabase
          .from('short_urls')
          .update({ clicks_count: link.clicks_count + 1 })
          .eq('id', link.id)
          .then(({ error }: any) => {
            if (error) console.error('Failed to increment clicks:', error);
          })
      )
    );

    // 6. Perform the redirect
    return NextResponse.redirect(link.original_url);

  } catch (error) {
    console.error("Proxy DB Error:", error);
    return response;
  }
}
