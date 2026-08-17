import { NextResponse } from 'next/server';

const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk').trim();
const SERVICE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0').trim();
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.mavtop.in').trim();
const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || 'shortlinks.fun').trim();

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
  let debugStatus = 0;
  let debugText = '';

  try {
    const url = `${SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*`;
    const res = await fetch(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    debugStatus = res.status;
    debugText = await res.text();

    if (res.ok) {
      const links = JSON.parse(debugText);
      if (Array.isArray(links) && links.length > 0 && links[0].original_url) {
        matchedLink = links[0];
      }
    }
  } catch (err: any) {
    debugText = err?.message || String(err);
  }

  if (matchedLink && matchedLink.original_url) {
    // Asynchronously update click count
    fetch(`${SUPABASE_URL}/rest/v1/short_urls?id=eq.${matchedLink.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ clicks_count: (matchedLink.clicks_count || 0) + 1 }),
    }).catch(() => {});

    // Perform immediate 307 HTTP redirect
    return NextResponse.redirect(matchedLink.original_url, 307);
  }

  const res = NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  res.headers.set('x-debug-url', SUPABASE_URL);
  res.headers.set('x-debug-status', String(debugStatus));
  res.headers.set('x-debug-key-len', String(SERVICE_KEY.length));
  res.headers.set('x-debug-text', debugText.slice(0, 100));
  return res;
}
