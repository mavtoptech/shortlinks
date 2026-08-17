import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || 'shortlinks.fun').trim();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug || slug.includes('.')) {
    return NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  }

  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const isCustomDomain = host && host !== APP_DOMAIN && !host.includes('localhost') && !host.startsWith('127.') && !host.startsWith('192.');

  try {
    let shortUrl;
    if (isCustomDomain) {
      shortUrl = await prisma.shortUrl.findFirst({
        where: {
          shortCode: slug,
          customDomain: {
            domain: host,
            status: 'active',
          },
        },
      });
    } else {
      shortUrl = await prisma.shortUrl.findUnique({
        where: { shortCode: slug },
      });
    }

    if (!shortUrl) {
      return NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
    }

    // Increment clicks asynchronously
    prisma.shortUrl.update({
      where: { id: shortUrl.id },
      data: { clicksCount: { increment: 1 } },
    }).catch(() => {});

    return NextResponse.redirect(shortUrl.originalUrl, { status: 301 });
  } catch (err) {
    console.error('[slug/route] Error:', err);
    return NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  }
}
