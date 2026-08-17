import { prisma } from "@/lib/db";

const OTP_EXPIRY_MINUTES = 15;

// Generate a random 6-digit OTP code
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Save OTP to database, invalidating any previous codes for same email+type
export async function saveOtp(
  email: string,
  code: string,
  type: "signup" | "recovery",
  userId?: string
): Promise<void> {
  // Invalidate existing unused OTPs for this email+type
  await prisma.otpCode.updateMany({
    where: { email, type, used: false },
    data: { used: true },
  });

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      email,
      code,
      type,
      expiresAt,
      userId: userId ?? null,
    },
  });
}

// Verify an OTP — returns true and marks it used if valid
export async function verifyOtp(
  email: string,
  code: string,
  type: "signup" | "recovery"
): Promise<{ valid: boolean; error?: string }> {
  const otp = await prisma.otpCode.findFirst({
    where: {
      email,
      code,
      type,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { valid: false, error: "Invalid or expired code. Please request a new one." };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  });

  return { valid: true };
}
