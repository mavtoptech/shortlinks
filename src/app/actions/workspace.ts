'use server'

import { revalidatePath } from "next/cache";
import dns from 'node:dns/promises';
import { CNAME_TARGET, APP_DOMAIN } from "@/lib/constants";
import { registerDomainForSSL, unregisterDomainFromSSL } from "@/lib/coolify";
import { prisma, ensureTables } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export async function getOrCreateWorkspace() {
  await ensureTables();
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  // 1. Check if workspace exists
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: session.userId },
  });

  if (workspace) return workspace;

  // 2. If not, create a default workspace
  return prisma.workspace.create({
    data: {
      name: 'My Workspace',
      ownerId: session.userId,
    },
  });
}

export async function getWorkspaceDomains(workspaceId: string) {
  return prisma.customDomain.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getWorkspaceLinks(workspaceId: string) {
  return prisma.shortUrl.findMany({
    where: { workspaceId },
    include: { customDomain: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addWorkspaceDomain(formData: FormData) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  const domain = formData.get('domain') as string;
  if (!domain || domain.trim() === '') throw new Error("Domain is required");

  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(cleanDomain)) {
    throw new Error("Invalid domain format");
  }

  const workspace = await getOrCreateWorkspace();

  // Check global uniqueness
  const existing = await prisma.customDomain.findUnique({ where: { domain: cleanDomain } });
  if (existing) throw new Error("Domain is already claimed");

  await prisma.customDomain.create({
    data: {
      domain: cleanDomain,
      status: 'pending',
      workspaceId: workspace.id,
    },
  });

  revalidatePath('/dashboard/domains');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteWorkspaceDomain(formData: FormData) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  const domainId = formData.get('domainId') as string;
  if (!domainId) throw new Error("Domain ID is required");

  const workspace = await getOrCreateWorkspace();

  const domain = await prisma.customDomain.findUnique({ where: { id: domainId } });
  if (!domain || domain.workspaceId !== workspace.id) {
    throw new Error("Domain not found or unauthorized");
  }

  try {
    await unregisterDomainFromSSL(domain.domain);
  } catch (error) {
    console.error("Failed to unregister domain from Coolify:", error);
  }

  await prisma.customDomain.delete({ where: { id: domainId } });

  revalidatePath('/dashboard/domains');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function verifyWorkspaceDomain(domainId: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  const workspace = await getOrCreateWorkspace();

  const domain = await prisma.customDomain.findUnique({ where: { id: domainId } });
  if (!domain || domain.workspaceId !== workspace.id) {
    throw new Error("Domain not found or unauthorized");
  }

  try {
    let isValid = false;
    let errorMessage = "Invalid Configuration";

    const parts = domain.domain.split('.');
    const isRootDomain = parts.length === 2;

    if (isRootDomain) {
      const records = await dns.resolve4(domain.domain);
      if (records && records.length > 0) {
        isValid = true;
      } else {
        errorMessage = "No A record found";
      }
    } else {
      try {
        const records = await dns.resolveCname(domain.domain);
        const validTargets = [
          CNAME_TARGET, CNAME_TARGET + '.',
          APP_DOMAIN, APP_DOMAIN + '.',
          `cname.${APP_DOMAIN}`, `cname.${APP_DOMAIN}.`,
        ];
        if (records.some(r => validTargets.includes(r))) {
          isValid = true;
        } else {
          errorMessage = "CNAME points to the wrong target";
        }
      } catch (err: any) {
        if (err.code === 'ENODATA') errorMessage = "No CNAME record found. Did you add an A record instead?";
        else if (err.code === 'ENOTFOUND') errorMessage = "Domain not found in DNS registry";
      }
    }

    if (isValid) {
      try {
        await registerDomainForSSL(domain.domain);
      } catch (sslError) {
        console.error("Failed to register SSL with Coolify:", sslError);
        return { success: false, error: "DNS is valid, but failed to provision SSL. Please try again later." };
      }

      await prisma.customDomain.update({ where: { id: domainId }, data: { status: 'active' } });

      revalidatePath('/dashboard/domains');
      revalidatePath('/dashboard');
      return { success: true, message: "Valid Configuration" };
    } else {
      await prisma.customDomain.update({ where: { id: domainId }, data: { status: 'pending' } });
      revalidatePath('/dashboard/domains');
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error("DNS Verification Error:", error);
    return { success: false, error: "Failed to verify domain: " + (error.message || "Unknown error") };
  }
}
