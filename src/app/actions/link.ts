'use server'

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getOrCreateWorkspace } from "./workspace";
import crypto from "crypto";

export async function createShortLink(formData: FormData) {
  const userId = await requireAuth();

  const originalUrl = formData.get('originalUrl') as string;
  const domainId = formData.get('domainId') as string;

  if (!originalUrl) {
    throw new Error("URL is required");
  }

  // Ensure valid URL
  let parsedUrl;
  try {
    parsedUrl = new URL(originalUrl);
  } catch (e) {
    throw new Error("Invalid URL provided");
  }

  // Get user's workspace
  const workspace = await getOrCreateWorkspace();

  // Generate a random 6-character short code
  // In a real production app, we would loop to ensure uniqueness if there's a collision
  const shortCode = crypto.randomBytes(4).toString('base64url').slice(0, 6);

  await prisma.shortUrl.create({
    data: {
      originalUrl: parsedUrl.toString(),
      shortCode,
      workspaceId: workspace.id,
      domainId: domainId === 'default' ? null : domainId,
    }
  });

  revalidatePath('/dashboard');
}
