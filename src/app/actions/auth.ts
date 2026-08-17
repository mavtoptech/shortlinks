"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { sendOtpEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Zod schemas for input validation and security checks
const emailSchema = z.string().email("Invalid email address").max(255, "Email is too long");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72, "Password is too long");
const nameSchema = z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long");
const otpSchema = z.string().length(6, "Confirmation code must be 6 digits");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.mavtop.in";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NjcyMzIwMCwiZXhwIjo0OTQyMzk2ODAwLCJyb2xlIjoiYW5vbiJ9.T9LfvS85FJi8_cK-e6WXgRP_yVOZUmrwawJEGVCH8Xk";

export async function signUp(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;
  const passwordInput = formData.get("password") as string;
  const nameInput = formData.get("name") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const password = passwordSchema.parse(passwordInput);
    const name = nameSchema.parse(nameInput);

    const supabaseAdmin = createAdminClient();

    // Generate signup OTP via Supabase Admin API without invoking GoTrue mailer
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    const emailOtp = data?.properties?.email_otp;
    if (!emailOtp) {
      return { error: "Failed to generate confirmation code" };
    }

    // Dispatch email securely via ZeptoMail by Zoho
    const emailResult = await sendOtpEmail({
      to: email,
      otp: emailOtp,
      type: "signup",
    });

    if (!emailResult.success) {
      return { error: emailResult.error || "Failed to send confirmation email" };
    }
  } catch (err: any) {
    console.error("[Auth Error - signUp]", err);
    if (err instanceof z.ZodError) {
      return { error: err.issues?.[0]?.message || err.message };
    }
    return { error: err?.message || "An unexpected error occurred" };
  }

  // Redirect user to email verification page with encoded email parameter
  redirect(`/verify-email?email=${encodeURIComponent(emailInput)}`);
}

export async function verifyOtpAction(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;
  const codeInput = formData.get("code") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const code = otpSchema.parse(codeInput);

    // Use a clean isolated client — no cookie inheritance
    const cleanClient = createSupabaseJsClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await cleanClient.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });

    if (error) {
      return { error: error.message };
    }

    // Set session cookies manually so the user is logged in after verifying
    if (data?.session) {
      const cookieStore = await cookies();
      const sessionJson = JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      });
      cookieStore.set("sb-session", sessionJson, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      // Also set the standard Supabase SSR cookies
      cookieStore.set("sb-access-token", data.session.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
      cookieStore.set("sb-refresh-token", data.session.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  } catch (err: any) {
    console.error("[Auth Error - verifyOtpAction]", err);
    if (err instanceof z.ZodError) {
      return { error: err.issues?.[0]?.message || err.message };
    }
    return { error: err?.message || "An unexpected error occurred" };
  }

  redirect("/dashboard");
}

export async function resendOtpAction(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const supabaseAdmin = createAdminClient();

    // Use type: "magiclink" to generate a new 6-digit email_otp without requiring password
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (error) {
      return { error: error.message };
    }

    const emailOtp = data?.properties?.email_otp;
    if (!emailOtp) {
      return { error: "Failed to generate new confirmation code" };
    }

    const emailResult = await sendOtpEmail({
      to: email,
      otp: emailOtp,
      type: "signup",
    });

    if (!emailResult.success) {
      return { error: emailResult.error || "Failed to resend confirmation email" };
    }

    return { success: true, message: "A new 6-digit confirmation code has been sent to your email." };
  } catch (err: any) {
    console.error("[Auth Error - resendOtpAction]", err);
    if (err instanceof z.ZodError) {
      return { error: err.issues?.[0]?.message || err.message };
    }
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

    // Use a completely isolated Supabase JS client with no cookie inheritance
    // This avoids stale browser cookies causing 401 at Kong API Gateway
    const cleanAuthClient = createSupabaseJsClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await cleanAuthClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const errMsg = error.message.toLowerCase();
      if (
        errMsg.includes("email not confirmed") ||
        errMsg.includes("email unconfirmed") ||
        errMsg.includes("confirm your email") ||
        error.code === "email_not_confirmed"
      ) {
        shouldRedirectToVerify = true;
        try {
          const supabaseAdmin = createAdminClient();
          const linkRes = await supabaseAdmin.auth.admin.generateLink({
            type: "signup",
            email,
            password,
          });
          const emailOtp = linkRes.data?.properties?.email_otp;
          if (emailOtp) {
            await sendOtpEmail({ to: email, otp: emailOtp, type: "signup" });
          }
        } catch (_) {}
      } else {
        return { error: error.message };
      }
    } else if (data?.session) {
      if (!data.user.email_confirmed_at) {
        shouldRedirectToVerify = true;
        try {
          const supabaseAdmin = createAdminClient();
          const linkRes = await supabaseAdmin.auth.admin.generateLink({
            type: "signup",
            email,
            password,
          });
          const emailOtp = linkRes.data?.properties?.email_otp;
          if (emailOtp) {
            await sendOtpEmail({ to: email, otp: emailOtp, type: "signup" });
          }
        } catch (_) {}
      } else {
        // Write session cookies directly without using createServerClient
        // This avoids any risk of the server client triggering 401 at Kong
        const cookieStore = await cookies();
        const { createServerClient } = await import("@supabase/ssr");
        const serverClient = createServerClient(SUPABASE_URL, ANON_KEY, {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {}
            },
          },
        });

        await serverClient.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
    }
  } catch (err: any) {
    console.error("[Auth Error - signIn]", err);
    if (err instanceof z.ZodError) {
      return { error: err.issues?.[0]?.message || err.message };
    }
    return { error: err?.message || "An unexpected error occurred" };
  }

  if (shouldRedirectToVerify) {
    redirect(`/verify-email?email=${encodeURIComponent(emailInput)}`);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const cookieStore = await cookies();
  const { createServerClient } = await import("@supabase/ssr");
  const serverClient = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
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

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) {
      // Prevent user enumeration attacks by returning generic success message
      return {
        success: true,
        email,
        message: "If an account with this email exists, we have sent a 6-digit confirmation code to your inbox.",
      };
    }

    const emailOtp = data?.properties?.email_otp;
    if (emailOtp) {
      await sendOtpEmail({
        to: email,
        otp: emailOtp,
        type: "recovery",
      });
    }

    return {
      success: true,
      email,
      message: "If an account with this email exists, we have sent a 6-digit confirmation code to your inbox.",
    };
  } catch (err: any) {
    console.error("[Auth Error - sendPasswordReset]", err);
    if (err instanceof z.ZodError) {
      return { error: err.issues?.[0]?.message || err.message };
    }
    return { error: err?.message || "An unexpected error occurred" };
  }
}

export async function verifyResetCodeAction(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;
  const codeInput = formData.get("code") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const code = otpSchema.parse(codeInput);

    // Use isolated client for OTP verification
    const cleanClient = createSupabaseJsClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await cleanClient.auth.verifyOtp({
      email,
      token: code,
      type: "recovery",
    });

    if (error) {
      return { error: error.message };
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return { error: err.issues?.[0]?.message || err.message };
    }
    return { error: "An unexpected error occurred" };
  }

  redirect("/update-password");
}

export async function updatePasswordAction(prevState: any, formData: FormData) {
  const passwordInput = formData.get("password") as string;

  try {
    const password = passwordSchema.parse(passwordInput);
    const cookieStore = await cookies();
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    });

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      return { error: error.message };
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return { error: err.issues?.[0]?.message || err.message };
    }
    return { error: "An unexpected error occurred" };
  }

  redirect("/dashboard");
}
