import { NextResponse } from 'next/server';

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk';
const SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.mavtop.in';
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'shortlinks.fun';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug || slug.includes('.')) {
    return NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  }

  let matchedLink = null;
  let dbStatus = 0;
  let dbErrText = '';

  try {
    let dbRes = await fetch(`${SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    dbStatus = dbRes.status;

    if (!dbRes.ok) {
      dbErrText = await dbRes.text();
      dbRes = await fetch(`${SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*`, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });
      dbStatus = dbRes.status;
    }

    if (dbRes.ok) {
      const links = await dbRes.json();
      if (Array.isArray(links) && links.length > 0 && links[0].original_url) {
        matchedLink = links[0];
      } else {
        dbErrText = `links_empty_count_${Array.isArray(links) ? links.length : -1}`;
      }
    } else {
      dbErrText = await dbRes.text();
    }
  } catch (err: any) {
    dbErrText = err?.message || String(err);
  }

  if (matchedLink && matchedLink.original_url) {
    // Asynchronously update click count
    fetch(`${SUPABASE_URL}/rest/v1/short_urls?id=eq.${matchedLink.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ clicks_count: (matchedLink.clicks_count || 0) + 1 }),
    }).catch(() => {});

    // Perform immediate 307 HTTP redirect
    return NextResponse.redirect(matchedLink.original_url, 307);
  }

  const res = NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  res.headers.set('x-debug-slug', slug || 'EMPTY');
  res.headers.set('x-debug-status', String(dbStatus));
  res.headers.set('x-debug-err', dbErrText.slice(0, 100));
  return res;
}
