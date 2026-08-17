"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { sendOtpEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Zod schemas for input validation and security checks
const emailSchema = z.string().email("Invalid email address").max(255, "Email is too long");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72, "Password is too long");
const nameSchema = z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long");
const otpSchema = z.string().length(6, "Confirmation code must be 6 digits");

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.mavtop.in").trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk").trim();
const SERVICE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.26RM4vH8xM7vdkwc2A_aI79kOvmyhPoZbRHzcHs_fY0").trim();

// Direct GoTrue token endpoint — bypasses SDK JSON parsing issues entirely
async function signInWithPasswordDirect(email: string, password: string): Promise<{
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { id: string; email?: string; email_confirmed_at?: string | null };
  error?: string;
}> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (err: any) {
    return { error: `Network error: ${err.message}` };
  }

  const text = await res.text();

  // Kong sometimes returns plain text "Unauthorized" — handle gracefully
  if (!res.ok) {
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.error_description || parsed?.message || parsed?.error || text;
    } catch (_) {
      if (text.toLowerCase().includes("unauthorized")) {
        msg = "Invalid email or password";
      }
    }
    return { error: msg };
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    return { error: "Authentication service error. Please try again." };
  }
}

export async function signUp(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;
  const passwordInput = formData.get("password") as string;
  const nameInput = formData.get("name") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const password = passwordSchema.parse(passwordInput);
    const name = nameSchema.parse(nameInput);

    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      return { error: error.message };
    }

    const emailOtp = data?.properties?.email_otp;
    if (!emailOtp) {
      return { error: "Failed to generate confirmation code" };
    }

    const emailResult = await sendOtpEmail({ to: email, otp: emailOtp, type: "signup" });
    if (!emailResult.success) {
      return { error: emailResult.error || "Failed to send confirmation email" };
    }
  } catch (err: any) {
    console.error("[Auth Error - signUp]", err);
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message || err.message };
    return { error: err?.message || "An unexpected error occurred" };
  }

  redirect(`/verify-email?email=${encodeURIComponent(emailInput)}`);
}

export async function verifyOtpAction(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;
  const codeInput = formData.get("code") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const code = otpSchema.parse(codeInput);

    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: {
          "apikey": ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, token: code, type: "signup" }),
      });
    } catch (err: any) {
      return { error: `Network error: ${err.message}` };
    }

    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = JSON.parse(text)?.message || text; } catch (_) {}
      return { error: msg };
    }

    const session = JSON.parse(text);
    if (session?.access_token) {
      const cookieStore = await cookies();
      const serverClient = createServerClient(SUPABASE_URL, ANON_KEY, {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      });
      await serverClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  } catch (err: any) {
    console.error("[Auth Error - verifyOtpAction]", err);
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message || err.message };
    return { error: err?.message || "An unexpected error occurred" };
  }

  redirect("/dashboard");
}

export async function resendOtpAction(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) return { error: error.message };

    const emailOtp = data?.properties?.email_otp;
    if (!emailOtp) return { error: "Failed to generate new confirmation code" };

    const emailResult = await sendOtpEmail({ to: email, otp: emailOtp, type: "signup" });
    if (!emailResult.success) return { error: emailResult.error || "Failed to resend confirmation email" };

    return { success: true, message: "A new 6-digit confirmation code has been sent to your email." };
  } catch (err: any) {
    console.error("[Auth Error - resendOtpAction]", err);
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message || err.message };
    return { error: err?.message || "An unexpected error occurred" };
  }
}

export async function signIn(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;
  const passwordInput = formData.get("password") as string;
  let shouldRedirectToVerify = false;

  try {
    const email = emailSchema.parse(emailInput);
    const password = passwordSchema.parse(passwordInput);

    // Call GoTrue token endpoint directly to avoid SDK JSON parsing issues
    const authResult = await signInWithPasswordDirect(email, password);

    if (authResult.error) {
      const errMsg = authResult.error.toLowerCase();
      if (
        errMsg.includes("email not confirmed") ||
        errMsg.includes("email unconfirmed") ||
        errMsg.includes("confirm your email") ||
        errMsg.includes("not confirmed")
      ) {
        shouldRedirectToVerify = true;
        try {
          const supabaseAdmin = createAdminClient();
          const linkRes = await supabaseAdmin.auth.admin.generateLink({ type: "signup", email, password });
          const emailOtp = linkRes.data?.properties?.email_otp;
          if (emailOtp) await sendOtpEmail({ to: email, otp: emailOtp, type: "signup" });
        } catch (_) {}
      } else {
        return { error: authResult.error };
      }
    } else if (authResult.access_token) {
      const user = authResult.user;
      if (user && !user.email_confirmed_at) {
        shouldRedirectToVerify = true;
        try {
          const supabaseAdmin = createAdminClient();
          const linkRes = await supabaseAdmin.auth.admin.generateLink({ type: "signup", email, password });
          const emailOtp = linkRes.data?.properties?.email_otp;
          if (emailOtp) await sendOtpEmail({ to: email, otp: emailOtp, type: "signup" });
        } catch (_) {}
      } else {
        // Set session cookies via server client
        const cookieStore = await cookies();
        const serverClient = createServerClient(SUPABASE_URL, ANON_KEY, {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
              try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
            },
          },
        });
        await serverClient.auth.setSession({
          access_token: authResult.access_token,
          refresh_token: authResult.refresh_token!,
        });
      }
    }
  } catch (err: any) {
    console.error("[Auth Error - signIn]", err);
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message || err.message };
    return { error: err?.message || "An unexpected error occurred" };
  }

  if (shouldRedirectToVerify) {
    redirect(`/verify-email?email=${encodeURIComponent(emailInput)}`);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const cookieStore = await cookies();
  const serverClient = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
      },
    },
  });
  await serverClient.auth.signOut();
  redirect("/sign-in");
}

export async function sendPasswordReset(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email });
    if (!error) {
      const emailOtp = data?.properties?.email_otp;
      if (emailOtp) await sendOtpEmail({ to: email, otp: emailOtp, type: "recovery" });
    }

    return {
      success: true,
      email,
      message: "If an account with this email exists, we have sent a 6-digit confirmation code to your inbox.",
    };
  } catch (err: any) {
    console.error("[Auth Error - sendPasswordReset]", err);
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message || err.message };
    return { error: err?.message || "An unexpected error occurred" };
  }
}

export async function verifyResetCodeAction(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;
  const codeInput = formData.get("code") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const code = otpSchema.parse(codeInput);

    const cleanClient = createSupabaseJsClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await cleanClient.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (error) return { error: error.message };
  } catch (err: any) {
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message || err.message };
    return { error: "An unexpected error occurred" };
  }

  redirect("/update-password");
}

export async function updatePasswordAction(prevState: any, formData: FormData) {
  const passwordInput = formData.get("password") as string;

  try {
    const password = passwordSchema.parse(passwordInput);
    const cookieStore = await cookies();
    const serverClient = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    });

    const { error } = await serverClient.auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch (err: any) {
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message || err.message };
    return { error: "An unexpected error occurred" };
  }

  redirect("/dashboard");
}
