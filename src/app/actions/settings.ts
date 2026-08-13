"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const userId = await requireAuth();
  
  const name = formData.get("name") as string;
  if (!name) throw new Error("Name is required");

  await prisma.user.update({
    where: { id: userId },
    data: { name },
  });

  revalidatePath("/dashboard/settings");
}
