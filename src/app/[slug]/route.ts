import { NextResponse } from 'next/server';

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk';
const SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.mavtop.in';
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'shortlinks.fun';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || slug.includes('.')) {
    return NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  }

  let debugStatus = 0;
  let debugErr = '';
  let linksCount = -1;

  try {
    // 1. Fetch shortlink from PostgREST using Node.js runtime
    let dbRes = await fetch(`${SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*,custom_domains(domain)`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    debugStatus = dbRes.status;

    if (!dbRes.ok) {
      debugErr = await dbRes.text();
      dbRes = await fetch(`${SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*,custom_domains(domain)`, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });
      debugStatus = dbRes.status;
    }

    if (dbRes.ok) {
      const links = await dbRes.json();
      linksCount = Array.isArray(links) ? links.length : 0;
      const link = Array.isArray(links) ? links[0] : null;

      if (link && link.original_url) {
        // Asynchronously update click count
        fetch(`${SUPABASE_URL}/rest/v1/short_urls?id=eq.${link.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ clicks_count: (link.clicks_count || 0) + 1 }),
        }).catch((e) => console.error('Failed to increment clicks count:', e));

        // 307 Redirect directly to target URL
        return NextResponse.redirect(link.original_url, 307);
      }
    } else {
      debugErr = await dbRes.text();
    }
  } catch (err: any) {
    console.error('[Route Handler Shortlink Error]', err);
    debugErr = err?.message || String(err);
  }

  const res = NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  res.headers.set('x-debug-route-slug', slug);
  res.headers.set('x-debug-route-status', String(debugStatus));
  res.headers.set('x-debug-route-count', String(linksCount));
  res.headers.set('x-debug-route-err', debugErr.slice(0, 100));
  return res;
}
