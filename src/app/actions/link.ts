'use server'

import { revalidatePath } from "next/cache";
import { getOrCreateWorkspace } from "./workspace";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function createShortLink(formData: FormData) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  const originalUrl = formData.get('originalUrl') as string;
  const domainId = formData.get('domainId') as string;

  if (!originalUrl) throw new Error("URL is required");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(originalUrl);
  } catch {
    throw new Error("Invalid URL provided");
  }

  const workspace = await getOrCreateWorkspace();

  // Generate unique short code with collision detection
  let shortCode = crypto.randomBytes(4).toString('base64url').slice(0, 6);
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.shortUrl.findUnique({ where: { shortCode } });
    if (!existing) break;
    shortCode = crypto.randomBytes(4).toString('base64url').slice(0, 6);
    attempts++;
  }

  await prisma.shortUrl.create({
    data: {
      originalUrl: parsedUrl.toString(),
      shortCode,
      workspaceId: workspace.id,
      domainId: domainId === 'default' ? null : domainId,
    },
  });

  revalidatePath('/dashboard');
}

export async function deleteShortLink(linkId: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  const workspace = await getOrCreateWorkspace();

  await prisma.shortUrl.deleteMany({
    where: { id: linkId, workspaceId: workspace.id },
  });

  revalidatePath('/dashboard');
}
