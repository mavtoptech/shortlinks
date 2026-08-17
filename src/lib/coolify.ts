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

  // Extract clean domains from the https://domain:port format
  const cleanDomains = unique.map(d => {
    try {
      const u = new URL(d);
      return u.hostname;
    } catch (e) {
      return d.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    }
  });

  // Generate Traefik/Caddy custom labels to ensure Coolify provisions the SSL certs properly
  let labels = `traefik.enable=true
traefik.http.middlewares.gzip.compress=true
traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https\n`;

  cleanDomains.forEach((domain, idx) => {
    labels += `traefik.http.routers.http-${idx}-${COOLIFY_APP_UUID}.entryPoints=http
traefik.http.routers.http-${idx}-${COOLIFY_APP_UUID}.middlewares=redirect-to-https
traefik.http.routers.http-${idx}-${COOLIFY_APP_UUID}.rule=Host(\`${domain}\`) && PathPrefix(\`/\`)
traefik.http.routers.http-${idx}-${COOLIFY_APP_UUID}.service=http-${idx}-${COOLIFY_APP_UUID}
traefik.http.routers.https-${idx}-${COOLIFY_APP_UUID}.entryPoints=https
traefik.http.routers.https-${idx}-${COOLIFY_APP_UUID}.middlewares=gzip
traefik.http.routers.https-${idx}-${COOLIFY_APP_UUID}.rule=Host(\`${domain}\`) && PathPrefix(\`/\`)
traefik.http.routers.https-${idx}-${COOLIFY_APP_UUID}.service=https-${idx}-${COOLIFY_APP_UUID}
traefik.http.routers.https-${idx}-${COOLIFY_APP_UUID}.tls.certresolver=letsencrypt
traefik.http.routers.https-${idx}-${COOLIFY_APP_UUID}.tls=true
traefik.http.services.http-${idx}-${COOLIFY_APP_UUID}.loadbalancer.server.port=${APP_PORT}
traefik.http.services.https-${idx}-${COOLIFY_APP_UUID}.loadbalancer.server.port=${APP_PORT}
caddy_${idx}.encode=zstd gzip
caddy_${idx}.handle_path.${idx}_reverse_proxy={{upstreams ${APP_PORT}}}
caddy_${idx}.handle_path=/*
caddy_${idx}.header=-Server
caddy_${idx}.try_files={path} /index.html /index.php
caddy_${idx}=https://${domain}\n`;
  });

  labels += `caddy_ingress_network=coolify`;
  const base64Labels = Buffer.from(labels).toString('base64');

  const res = await fetch(`${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ domains: domainsStr, custom_labels: base64Labels }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to update Coolify FQDN: ${res.status} ${body}`);
  }

  // Trigger a redeployment/restart to apply the new Traefik labels
  console.log('[SSL] Triggering Coolify deployment to apply new FQDNs...');
  const deployRes = await fetch(`${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
      Accept: 'application/json',
    },
  });

  if (!deployRes.ok) {
    console.error(`[SSL] Failed to trigger deployment: ${deployRes.status} ${await deployRes.text()}`);
    // We don't throw here because the FQDN update was successful,
    // the user might just have to wait or trigger it manually later.
  } else {
    console.log('[SSL] Deployment triggered successfully.');
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
