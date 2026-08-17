'use server'

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import dns from 'node:dns/promises';
import { CNAME_TARGET, APP_DOMAIN } from "@/lib/constants";

export async function getOrCreateWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // 1. Check if workspace exists
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (workspace) return workspace;

  // 2. If not, create a default workspace
  const { data: newWorkspace, error } = await supabase
    .from('workspaces')
    .insert({
      name: 'My Workspace',
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return newWorkspace;
}

export async function getWorkspaceDomains(workspaceId: string) {
  const supabase = await createClient();
  const { data: domains } = await supabase
    .from('custom_domains')
    .select('*')
    .eq('workspace_id', workspaceId);
  
  return domains || [];
}

export async function getWorkspaceLinks(workspaceId: string) {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from('short_urls')
    .select(`
      *,
      domain:custom_domains(*)
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  
  return links || [];
}

export async function addWorkspaceDomain(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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
  const { data: existingDomain } = await supabase
    .from('custom_domains')
    .select('*')
    .eq('domain', cleanDomain)
    .single();

  if (existingDomain) {
    throw new Error("Domain is already claimed");
  }

  // Create the domain with pending status
  const { error } = await supabase
    .from('custom_domains')
    .insert({
      domain: cleanDomain,
      status: 'pending', // Assume DNS verification is pending
      workspace_id: workspace.id,
    });

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/domains');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteWorkspaceDomain(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const domainId = formData.get('domainId') as string;
  if (!domainId) throw new Error("Domain ID is required");

  const workspace = await getOrCreateWorkspace();

  // Verify ownership
  const { data: domain } = await supabase
    .from('custom_domains')
    .select('*')
    .eq('id', domainId)
    .single();

  if (!domain || domain.workspace_id !== workspace.id) {
    throw new Error("Domain not found or unauthorized");
  }

  // Delete domain
  const { error } = await supabase
    .from('custom_domains')
    .delete()
    .eq('id', domainId);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/domains');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function verifyWorkspaceDomain(domainId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const workspace = await getOrCreateWorkspace();

  const { data: domain } = await supabase
    .from('custom_domains')
    .select('*')
    .eq('id', domainId)
    .single();

  if (!domain || domain.workspace_id !== workspace.id) {
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
        // Real-world validation: check if it points to our main domain, cname subdomain, or specified target
        const validTargets = [
          CNAME_TARGET,
          CNAME_TARGET + '.',
          APP_DOMAIN,
          APP_DOMAIN + '.',
          `cname.${APP_DOMAIN}`,
          `cname.${APP_DOMAIN}.`
        ];

        const isMatch = records.some(record => validTargets.includes(record));

        if (isMatch) {
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
      await supabase
        .from('custom_domains')
        .update({ status: 'active' })
        .eq('id', domainId);

      revalidatePath('/dashboard/domains');
      revalidatePath('/dashboard');
      return { success: true, message: "Valid Configuration" };
    } else {
      await supabase
        .from('custom_domains')
        .update({ status: 'pending' })
        .eq('id', domainId);

      revalidatePath('/dashboard/domains');
      return { success: false, error: errorMessage };
    }

  } catch (error: any) {
    console.error("DNS Verification Error:", error);
    return { success: false, error: "Failed to verify domain: " + (error.message || "Unknown error") };
  }
}
