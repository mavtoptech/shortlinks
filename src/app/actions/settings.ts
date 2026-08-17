"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateProfileAction(prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const name = formData.get("name") as string;
    if (!name || !name.trim()) return { error: "Full name is required" };

    // Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id, 
        name: name.trim()
      });

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Update user metadata in auth
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: name.trim(), name: name.trim() }
    });

    if (authError) return { error: authError.message };

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, message: "Profile updated successfully!" };
  } catch (err: any) {
    return { error: err.message || "Failed to update profile" };
  }
}

export async function updatePasswordAction(prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!newPassword || newPassword.length < 6) {
      return { error: "Password must be at least 6 characters long" };
    }

    if (newPassword !== confirmPassword) {
      return { error: "Passwords do not match" };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };

    return { success: true, message: "Password updated successfully!" };
  } catch (err: any) {
    return { error: err.message || "Failed to update password" };
  }
}

export async function deleteAccountAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Delete profile record
    await supabase.from('profiles').delete().eq('id', user.id);
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}
