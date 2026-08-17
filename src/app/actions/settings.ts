"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, signToken, setSessionCookie } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

export async function updateProfileAction(prevState: any, formData: FormData) {
  try {
    const session = await getSessionUser();
    if (!session) return { error: "Not authenticated" };

    const name = formData.get("name") as string;
    if (!name || !name.trim()) return { error: "Full name is required" };

    await prisma.user.update({
      where: { id: session.userId },
      data: { name: name.trim() },
    });

    // Refresh session token with updated name
    const token = await signToken({ userId: session.userId, email: session.email, name: name.trim() });
    await setSessionCookie(token);

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, message: "Profile updated successfully!" };
  } catch (err: any) {
    return { error: err.message || "Failed to update profile" };
  }
}

export async function updatePasswordAction(prevState: any, formData: FormData) {
  try {
    const session = await getSessionUser();
    if (!session) return { error: "Not authenticated" };

    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!newPassword || newPassword.length < 6) {
      return { error: "Password must be at least 6 characters long" };
    }
    if (newPassword !== confirmPassword) {
      return { error: "Passwords do not match" };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash },
    });

    return { success: true, message: "Password updated successfully!" };
  } catch (err: any) {
    return { error: err.message || "Failed to update password" };
  }
}

export async function deleteAccountAction() {
  const session = await getSessionUser();
  if (session) {
    // Cascade deletes workspace, links, domains via Prisma relations
    await prisma.user.delete({ where: { id: session.userId } }).catch(() => {});
  }
  redirect("/sign-in");
}
