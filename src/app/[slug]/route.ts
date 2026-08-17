import { NextResponse } from 'next/server';
import https from 'node:https';

const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk').trim();
const SERVICE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0').trim();
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.mavtop.in').trim();
const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || 'shortlinks.fun').trim();

function fetchShortUrlRaw(slug: string, key: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const targetUrl = `${SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${encodeURIComponent(slug)}&select=*`;
    const req = https.request(targetUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json',
        'User-Agent': 'ShortLinksRedirect/1.0',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`JSON Parse Error: ${data}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
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

  let matchedLink = null;
  let debugErrText = '';

  try {
    // Query using ANON_KEY first
    let links = await fetchShortUrlRaw(slug, ANON_KEY).catch(async (anonErr) => {
      debugErrText = `anon_fail(${anonErr.message}) | `;
      return await fetchShortUrlRaw(slug, SERVICE_KEY);
    });

    if (Array.isArray(links) && links.length > 0 && links[0].original_url) {
      matchedLink = links[0];
    } else {
      debugErrText += `links_empty_${Array.isArray(links) ? links.length : -1}`;
    }
  } catch (err: any) {
    debugErrText += err?.message || String(err);
  }

  if (matchedLink && matchedLink.original_url) {
    // Asynchronously update click count
    try {
      const targetUrl = `${SUPABASE_URL}/rest/v1/short_urls?id=eq.${matchedLink.id}`;
      const req = https.request(targetUrl, {
        method: 'PATCH',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
      });
      req.write(JSON.stringify({ clicks_count: (matchedLink.clicks_count || 0) + 1 }));
      req.end();
    } catch (_) {}

    // Perform immediate 307 HTTP redirect
    return NextResponse.redirect(matchedLink.original_url, 307);
  }

  const res = NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  res.headers.set('x-debug-slug', slug || 'EMPTY');
  res.headers.set('x-debug-err', debugErrText.slice(0, 150));
  return res;
}
