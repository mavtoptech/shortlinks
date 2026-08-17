/**
 * Coolify Domain Management
 * 
 * Automatically registers/unregisters user custom domains in Coolify's
 * application FQDN list. This triggers Traefik to:
 *  1. Route traffic for that domain to the Next.js container
 *  2. Automatically provision a Let's Encrypt SSL certificate via ACME HTTP challenge
 */

const COOLIFY_URL = process.env.COOLIFY_URL!;
const COOLIFY_API_TOKEN = (process.env.COOLIFY_API_TOKEN || '').trim();
const COOLIFY_APP_UUID = process.env.COOLIFY_APP_UUID || 'suvthuty3smlakdt2yf0sgew';
const APP_PORT = process.env.COOLIFY_APP_PORT || '3000';

async function getCurrentFqdn(): Promise<string[]> {
  const res = await fetch(`${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}`, {
    headers: {
      Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
      Accept: 'application/json',
    },
    // Don't cache — always get the freshest list
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Coolify API error: ${res.status} ${await res.text()}`);
  }

  const app = await res.json();
  const fqdn: string = app.fqdn || '';
  return fqdn
    .split(',')
    .map((d: string) => d.trim())
    .filter(Boolean);
}

async function updateFqdn(domains: string[]): Promise<void> {
  const unique = [...new Set(domains)].filter(Boolean);
  const domainsStr = unique.join(',');

  const res = await fetch(`${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ domains: domainsStr }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to update Coolify FQDN: ${res.status} ${body}`);
  }
}

/**
 * Registers a user custom domain in Coolify.
 * Traefik will automatically provision an SSL certificate via Let's Encrypt.
 * Call this AFTER DNS verification passes.
 */
export async function registerDomainForSSL(domain: string): Promise<void> {
  // Normalize the domain: strip any protocols
  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

  // The entry Coolify/Traefik needs — include port for internal routing
  const fqdnEntry = `https://${cleanDomain}:${APP_PORT}`;

  const current = await getCurrentFqdn();

  if (current.includes(fqdnEntry)) {
    // Already registered — nothing to do
    console.log(`[SSL] Domain ${cleanDomain} already registered in Coolify.`);
    return;
  }

  await updateFqdn([...current, fqdnEntry]);
  console.log(`[SSL] Registered ${cleanDomain} in Coolify. Traefik will now issue a Let's Encrypt certificate.`);
}

/**
 * Unregisters a user custom domain from Coolify.
 * Call this when a user removes their custom domain.
 */
export async function unregisterDomainFromSSL(domain: string): Promise<void> {
  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const fqdnEntry = `https://${cleanDomain}:${APP_PORT}`;

  const current = await getCurrentFqdn();
  const updated = current.filter((d) => d !== fqdnEntry);

  if (updated.length === current.length) {
    // Domain wasn't registered — nothing to do
    console.log(`[SSL] Domain ${cleanDomain} was not in Coolify FQDN list.`);
    return;
  }

  await updateFqdn(updated);
  console.log(`[SSL] Unregistered ${cleanDomain} from Coolify.`);
}
