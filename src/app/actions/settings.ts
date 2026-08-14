"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  
  const name = formData.get("name") as string;
  if (!name) throw new Error("Name is required");

  const { error } = await supabase
    .from('profiles')
    .update({ name })
    .eq('id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
}
