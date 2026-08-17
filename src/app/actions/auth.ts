"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma, ensureTables } from "@/lib/db";
import { generateOtp, saveOtp, verifyOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/email";
import {
  signToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
} from "@/lib/auth/session";

const emailSchema = z.string().email("Invalid email address").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72);
const nameSchema = z.string().min(2, "Name must be at least 2 characters").max(100);
const otpSchema = z.string().length(6, "Confirmation code must be 6 digits");

export async function signUp(prevState: any, formData: FormData) {
  await ensureTables();
  const emailInput = formData.get("email") as string;
  const passwordInput = formData.get("password") as string;
  const nameInput = formData.get("name") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const password = passwordSchema.parse(passwordInput);
    const name = nameSchema.parse(nameInput);

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.emailVerified) {
      return { error: "An account with this email already exists. Please sign in." };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create or update user (handle re-signup for unverified accounts)
    const user = existing
      ? await prisma.user.update({
          where: { email },
          data: { passwordHash, name, emailVerified: false },
        })
      : await prisma.user.create({
          data: { email, passwordHash, name, emailVerified: false },
        });

    // Generate and save OTP
    const code = generateOtp();
    await saveOtp(email, code, "signup", user.id);

    // Send OTP email
    const emailResult = await sendOtpEmail({ to: email, otp: code, type: "signup" });
    if (!emailResult.success) {
      return { error: emailResult.error || "Failed to send confirmation email" };
    }
  } catch (err: any) {
    console.error("[Auth Error - signUp]", err);
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message };
    return { error: err?.message || "An unexpected error occurred" };
  }

  redirect(`/verify-email?email=${encodeURIComponent(emailInput)}`);
}

export async function verifyOtpAction(prevState: any, formData: FormData) {
  await ensureTables();
  const emailInput = formData.get("email") as string;
  const codeInput = formData.get("code") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const code = otpSchema.parse(codeInput);

    const result = await verifyOtp(email, code, "signup");
    if (!result.valid) return { error: result.error };

    // Mark user as verified
    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });

    // Create session
    const token = await signToken({ userId: user.id, email: user.email, name: user.name });
    await setSessionCookie(token);
  } catch (err: any) {
    console.error("[Auth Error - verifyOtpAction]", err);
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message };
    return { error: err?.message || "An unexpected error occurred" };
  }

  redirect("/dashboard");
}

export async function resendOtpAction(prevState: any, formData: FormData) {
  await ensureTables();
  const emailInput = formData.get("email") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { error: "No account found with this email" };

    const code = generateOtp();
    await saveOtp(email, code, "signup", user.id);

    const emailResult = await sendOtpEmail({ to: email, otp: code, type: "signup" });
    if (!emailResult.success) return { error: emailResult.error || "Failed to resend confirmation email" };

    return { success: true, message: "A new 6-digit confirmation code has been sent to your email." };
  } catch (err: any) {
    console.error("[Auth Error - resendOtpAction]", err);
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message };
    return { error: err?.message || "An unexpected error occurred" };
  }
}

export async function signIn(prevState: any, formData: FormData) {
  await ensureTables();
  const emailInput = formData.get("email") as string;
  const passwordInput = formData.get("password") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const password = passwordSchema.parse(passwordInput);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { error: "Invalid email or password" };
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return { error: "Invalid email or password" };
    }

    if (!user.emailVerified) {
      // Resend OTP and redirect to verify
      const code = generateOtp();
      await saveOtp(email, code, "signup", user.id);
      await sendOtpEmail({ to: email, otp: code, type: "signup" }).catch(() => {});
      redirect(`/verify-email?email=${encodeURIComponent(emailInput)}`);
    }

    const token = await signToken({ userId: user.id, email: user.email, name: user.name });
    await setSessionCookie(token);
  } catch (err: any) {
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message };
    // redirect() throws internally, let it propagate
    if (err?.message?.includes("NEXT_REDIRECT")) throw err;
    return { error: err?.message || "An unexpected error occurred" };
  }

  redirect("/dashboard");
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/sign-in");
}

export async function sendPasswordReset(prevState: any, formData: FormData) {
  await ensureTables();
  const emailInput = formData.get("email") as string;
  const successResponse = {
    success: true,
    email: emailInput,
    message: "If an account with this email exists, we have sent a 6-digit confirmation code to your inbox.",
  };

  try {
    const email = emailSchema.parse(emailInput);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const code = generateOtp();
      await saveOtp(email, code, "recovery", user.id);
      await sendOtpEmail({ to: email, otp: code, type: "recovery" }).catch(() => {});
    }

    return successResponse;
  } catch (err: any) {
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message };
    return successResponse; // Always return success to prevent user enumeration
  }
}

export async function verifyResetCodeAction(prevState: any, formData: FormData) {
  const emailInput = formData.get("email") as string;
  const codeInput = formData.get("code") as string;

  try {
    const email = emailSchema.parse(emailInput);
    const code = otpSchema.parse(codeInput);

    const result = await verifyOtp(email, code, "recovery");
    if (!result.valid) return { error: result.error };

    // Create a temporary recovery session so they can update password
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { error: "Account not found" };

    const token = await signToken({ userId: user.id, email: user.email, name: user.name });
    await setSessionCookie(token);
  } catch (err: any) {
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message };
    return { error: "An unexpected error occurred" };
  }

  redirect("/update-password");
}

export async function updatePasswordAction(prevState: any, formData: FormData) {
  const passwordInput = formData.get("password") as string;

  try {
    const password = passwordSchema.parse(passwordInput);
    const session = await getSessionUser();
    if (!session) return { error: "Not authenticated" };

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return { error: err.issues?.[0]?.message };
    return { error: "An unexpected error occurred" };
  }

  redirect("/dashboard");
}
