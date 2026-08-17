import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  let debugErrText = '';

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: link, error } = await supabaseAdmin
      .from('short_urls')
      .select('*')
      .eq('short_code', slug)
      .maybeSingle();

    if (error) {
      debugErrText = error.message;
    } else if (link && link.original_url) {
      matchedLink = link;
    }
  } catch (err: any) {
    debugErrText = err?.message || String(err);
  }

  if (matchedLink && matchedLink.original_url) {
    // Asynchronously update click count using service role client
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    Promise.resolve(
      supabaseAdmin
        .from('short_urls')
        .update({ clicks_count: (matchedLink.clicks_count || 0) + 1 })
        .eq('id', matchedLink.id)
    ).catch(() => {});

    // Perform immediate 307 HTTP redirect
    return NextResponse.redirect(matchedLink.original_url, 307);
  }

  const res = NextResponse.redirect(`https://${APP_DOMAIN}/not-found`, 307);
  res.headers.set('x-debug-slug', slug || 'EMPTY');
  res.headers.set('x-debug-err', debugErrText.slice(0, 100));
  return res;
}
