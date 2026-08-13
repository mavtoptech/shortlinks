import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

const encodedKey = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret_key_change_me_in_prod");

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;
  
  // Custom JWT Authentication for Dashboard and Auth routes
  const session = req.cookies.get('session')?.value;

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
    try {
      await jwtVerify(session, encodedKey, { algorithms: ["HS256"] });
    } catch (err) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
  }

  // Redirect authenticated users away from sign-in/sign-up
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
    if (session) {
      try {
        await jwtVerify(session, encodedKey, { algorithms: ["HS256"] });
        return NextResponse.redirect(new URL('/dashboard', req.url));
      } catch (err) {
        // Invalid session, let them sign in
      }
    }
  }

  // 1. Skip system routes for link resolution
  if (
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/trpc')
  ) {
    return NextResponse.next();
  }

  // 2. We have a potential short link! (e.g. /abc123)
  // Extract the slug (remove leading slash)
  const slug = pathname.substring(1);

  // If the slug contains another slash, it's not a standard shortlink, let Next.js handle it
  if (slug.includes('/')) {
    return NextResponse.next();
  }

  try {
    // 3. Find the URL in the database
    const link = await prisma.shortUrl.findUnique({
      where: { shortCode: slug },
      include: { domain: true }
    });

    if (!link) {
      // Short link not found, let it fall through to a 404 page
      return NextResponse.rewrite(new URL('/not-found', req.url));
    }

    // 4. Verify domain match
    const isDefaultDomain = !link.domainId;
    const isMatchingCustomDomain = link.domain && link.domain.domain === hostname;
    
    // We'll be lenient for local testing on localhost, but in production we'd strictly enforce domain matching
    const isLocalhost = hostname.includes('localhost') || hostname.includes('192.168');
    
    if (!isDefaultDomain && !isMatchingCustomDomain && !isLocalhost) {
      // The short link exists, but it belongs to a different custom domain!
      return NextResponse.rewrite(new URL('/not-found', req.url));
    }

    // 5. Asynchronously increment clicks without blocking the redirect!
    event.waitUntil(
      prisma.shortUrl.update({
        where: { id: link.id },
        data: { clicksCount: { increment: 1 } }
      }).catch(console.error)
    );

    // 6. Perform the redirect
    return NextResponse.redirect(link.originalUrl);

  } catch (error) {
    console.error("Proxy DB Error:", error);
    return NextResponse.next();
  }
}
