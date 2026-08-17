import { NextResponse } from 'next/server';
import http from 'node:http';
import https from 'node:https';

const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk').trim();
const SERVICE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0').trim();
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.mavtop.in').trim();
// SUPABASE_INTERNAL_REST_URL = "http://supabase-rest:3000" bypasses Traefik/Kong inside Docker
const INTERNAL_REST_URL = (process.env.SUPABASE_INTERNAL_REST_URL || `${SUPABASE_URL}/rest/v1`).trim();
const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || 'shortlinks.fun').trim();

function fetchUrl(targetUrl: string, key: string, customHost?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const isHttps = targetUrl.startsWith('https:');
    const client = isHttps ? https : http;
    const headers: Record<string, string> = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Accept': 'application/json',
      'User-Agent': 'ShortLinksRedirect/1.0',
    };
    if (customHost) {
      headers['Host'] = customHost;
    }

    const req = client.request(targetUrl, {
      method: 'GET',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });

    req.on('error', (err) => resolve({ status: 0, body: err.message }));
    req.end();
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug || slug.includes('.')) {
    return NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  }

  const queryPath = `/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*`;
  const candidates = [
    // Internal Docker network URL — bypasses Traefik/Kong entirely
    { url: `${INTERNAL_REST_URL}${queryPath}` },
    // Fallback to public URL via Kong gateway
    { url: `${SUPABASE_URL}/rest/v1${queryPath}` },
  ];

  let matchedLink = null;
  let attemptsLog: string[] = [];

  for (const candidate of candidates) {
    for (const [keyName, keyVal] of [['ANON', ANON_KEY], ['SERVICE', SERVICE_KEY]]) {
      const res = await fetchUrl(candidate.url, keyVal);
      const shortName = candidate.url.replace(queryPath, '');
      attemptsLog.push(`${shortName}(${keyName}):${res.status}`);

      if (res.status === 200) {
        try {
          const links = JSON.parse(res.body);
          if (Array.isArray(links) && links.length > 0 && links[0].original_url) {
            matchedLink = links[0];
            break;
          }
        } catch (_) {}
      }
    }
    if (matchedLink) break;
  }

  if (matchedLink && matchedLink.original_url) {
    // Asynchronously update click count
    try {
      fetchUrl(`${SUPABASE_URL}/rest/v1/short_urls?id=eq.${matchedLink.id}`, ANON_KEY).catch(() => {});
    } catch (_) {}

    // Perform immediate 307 HTTP redirect
    return NextResponse.redirect(matchedLink.original_url, 307);
  }

  const res = NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  res.headers.set('x-debug-slug', slug || 'EMPTY');
  res.headers.set('x-debug-attempts', attemptsLog.join(' | '));
  return res;
}
