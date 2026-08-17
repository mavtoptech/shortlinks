import { NextResponse } from 'next/server';

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk';
const SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.mavtop.in';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || slug.includes('.')) {
    return NextResponse.redirect(new URL('/not-found', request.url));
  }

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

    if (!dbRes.ok) {
      dbRes = await fetch(`${SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*,custom_domains(domain)`, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });
    }

    if (dbRes.ok) {
      const links = await dbRes.json();
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

        // 307 Redirect to target URL
        return NextResponse.redirect(link.original_url, 307);
      }
    }
  } catch (err) {
    console.error('[Route Handler Shortlink Error]', err);
  }

  return NextResponse.redirect(new URL('/not-found', request.url));
}
