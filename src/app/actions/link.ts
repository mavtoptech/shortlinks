'use server'

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getOrCreateWorkspace } from "./workspace";
import crypto from "crypto";

export async function createShortLink(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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

  const { error } = await supabase
    .from('short_urls')
    .insert({
      original_url: parsedUrl.toString(),
      short_code: shortCode,
      workspace_id: workspace.id,
      domain_id: domainId === 'default' ? null : domainId,
    });

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard');
}
