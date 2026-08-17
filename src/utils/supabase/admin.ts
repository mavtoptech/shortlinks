import { createClient } from "@supabase/supabase-js";

// Ensure this client is ONLY imported and used in Server Actions / Server Components
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser context.

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!serviceRoleKey) {
    console.warn(
      "[Supabase Admin] WARNING: SUPABASE_SERVICE_ROLE_KEY is not defined. Falling back to anon key. Admin auth actions may fail."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

