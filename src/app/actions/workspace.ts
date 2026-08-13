'use server'

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import dns from 'node:dns/promises';
import { CNAME_TARGET } from "@/lib/constants";

export async function getOrCreateWorkspace() {
  const userId = await requireAuth();

  // 1. Check if workspace exists
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
  });

  if (workspace) return workspace;

  // 2. If not, create a default workspace
  const newWorkspace = await prisma.workspace.create({
    data: {
      name: 'My Workspace',
      ownerId: userId,
    },
  });

  return newWorkspace;
}

export async function getWorkspaceDomains(workspaceId: string) {
  const domains = await prisma.customDomain.findMany({
    where: { workspaceId },
  });
  return domains;
}

export async function getWorkspaceLinks(workspaceId: string) {
  const links = await prisma.shortUrl.findMany({
    where: { workspaceId },
    include: {
      domain: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  return links;
}

export async function addWorkspaceDomain(formData: FormData) {
  const userId = await requireAuth();

  const domain = formData.get('domain') as string;
  if (!domain || domain.trim() === '') {
    throw new Error("Domain is required");
  }
  
  // Basic validation (e.g., lowercasing, stripping protocol)
  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').trim();

  // Validate format using simple regex
  if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(cleanDomain)) {
    throw new Error("Invalid domain format");
  }

  const workspace = await getOrCreateWorkspace();

  // Check if domain is already claimed by ANY user (enforce global uniqueness)
  const existingDomain = await prisma.customDomain.findUnique({
    where: { domain: cleanDomain }
  });

  if (existingDomain) {
    throw new Error("Domain is already claimed");
  }

  // Create the domain with pending status
  await prisma.customDomain.create({
    data: {
      domain: cleanDomain,
      status: 'pending', // Assume DNS verification is pending
      workspaceId: workspace.id,
    }
  });

  revalidatePath('/dashboard/domains');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteWorkspaceDomain(formData: FormData) {
  const userId = await requireAuth();

  const domainId = formData.get('domainId') as string;
  if (!domainId) throw new Error("Domain ID is required");

  const workspace = await getOrCreateWorkspace();

  // Verify ownership
  const domain = await prisma.customDomain.findUnique({
    where: { id: domainId }
  });

  if (!domain || domain.workspaceId !== workspace.id) {
    throw new Error("Domain not found or unauthorized");
  }

  // Delete domain
  await prisma.customDomain.delete({
    where: { id: domainId }
  });

  revalidatePath('/dashboard/domains');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function verifyWorkspaceDomain(domainId: string) {
  const userId = await requireAuth();

  const workspace = await getOrCreateWorkspace();

  const domain = await prisma.customDomain.findUnique({
    where: { id: domainId }
  });

  if (!domain || domain.workspaceId !== workspace.id) {
    throw new Error("Domain not found or unauthorized");
  }

  try {
    let isValid = false;
    let errorMessage = "Invalid Configuration";

    // For a real production app, we check if it's a root domain or subdomain.
    const parts = domain.domain.split('.');
    const isRootDomain = parts.length === 2; // e.g., mylink.com

    if (isRootDomain) {
      // Check A records
      const records = await dns.resolve4(domain.domain);
      // In a real app, check if it matches our Vercel/production IP
      if (records && records.length > 0) {
        isValid = true; // Simplified for now since we don't have a real IP
      } else {
        errorMessage = "No A record found";
      }
    } else {
      // Check CNAME records
      try {
        const records = await dns.resolveCname(domain.domain);
        if (records.includes(CNAME_TARGET) || records.includes(CNAME_TARGET + '.')) {
          isValid = true;
        } else {
          errorMessage = "CNAME points to the wrong target";
        }
      } catch (err: any) {
        if (err.code === 'ENODATA') {
           errorMessage = "No CNAME record found. Did you add an A record instead?";
        } else if (err.code === 'ENOTFOUND') {
           errorMessage = "Domain not found in DNS registry";
        }
      }
    }

    if (isValid) {
      await prisma.customDomain.update({
        where: { id: domainId },
        data: { status: 'active' }
      });
      revalidatePath('/dashboard/domains');
      revalidatePath('/dashboard');
      return { success: true, message: "Valid Configuration" };
    } else {
      await prisma.customDomain.update({
        where: { id: domainId },
        data: { status: 'pending' } 
      });
      revalidatePath('/dashboard/domains');
      return { success: false, error: errorMessage };
    }

  } catch (error: any) {
    console.error("DNS Verification Error:", error);
    return { success: false, error: "Failed to verify domain: " + (error.message || "Unknown error") };
  }
}
