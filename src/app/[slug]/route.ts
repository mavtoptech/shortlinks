import { NextResponse } from 'next/server';

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk';
const SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0';
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'shortlinks.fun';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || slug.includes('.')) {
    return NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  }

  let debugInfo = [];
  let matchedLink = null;

  // Test with explicit Host: supabase.mavtop.in header to prevent Traefik loopback to link.callwaves.in
  const keys = [['ANON', ANON_KEY], ['SERVICE', SERVICE_KEY]];

  for (const [keyName, keyVal] of keys) {
    try {
      const headers = new Headers();
      headers.set('apikey', keyVal);
      headers.set('Authorization', `Bearer ${keyVal}`);
      headers.set('Accept', 'application/json');
      headers.set('Host', 'supabase.mavtop.in');

      const res = await fetch(`https://supabase.mavtop.in/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*,custom_domains(domain)`, {
        headers,
        cache: 'no-store',
      });

      debugInfo.push(`HostOverride(${keyName}):${res.status}`);

      if (res.ok) {
        const links = await res.json();
        if (Array.isArray(links) && links.length > 0 && links[0].original_url) {
          matchedLink = links[0];
          break;
        }
      } else {
        const text = await res.text();
        debugInfo.push(`HostOverride(${keyName}):ERR(${text.slice(0, 50)})`);
      }
    } catch (err: any) {
      debugInfo.push(`HostOverride(${keyName}):EXC(${err.message})`);
    }
  }

  if (matchedLink && matchedLink.original_url) {
    // Asynchronously update click count
    fetch(`https://supabase.mavtop.in/rest/v1/short_urls?id=eq.${matchedLink.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'Host': 'supabase.mavtop.in',
      },
      body: JSON.stringify({ clicks_count: (matchedLink.clicks_count || 0) + 1 }),
    }).catch(() => {});

    return NextResponse.redirect(matchedLink.original_url, 307);
  }

  const res = NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  res.headers.set('x-debug-host-override', debugInfo.join(' | '));
  return res;
}
