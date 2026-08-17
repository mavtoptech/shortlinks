import { PrismaClient } from "@prisma/client";
import net from "node:net";

const DEFAULT_DB_PASS = "yGDAmEITo1SsVHKS9JtwcWbkxAmdU9MR";
const DEFAULT_DB_URL =
  process.env.DATABASE_URL ||
  `postgresql://postgres:${DEFAULT_DB_PASS}@supabase-db:5432/postgres?schema=public`;

const isDev = process.env.NODE_ENV === "development";

// Candidate hostnames inside Coolify Docker network (only used in production containers)
const CANDIDATE_HOSTS = [
  "2l4llui824evqnplabkdpx9k",
  "supabase-db-yword0jwkztgpiaha6g8ddou",
  "supabase-db-2l4llui824evqnplabkdpx9k",
  "supabase-db",
  "yword0jwkztgpiaha6g8ddou-supabase-db",
];

function probeHost(host: string, port = 5432, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: timeoutMs });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

let rawClientInstance: PrismaClient | null = null;
let isDiscovering = false;

function createClientForUrl(url: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url } },
    log: isDev ? ["error", "warn"] : ["error"],
  });
}

function getRawClient(): PrismaClient {
  if (!rawClientInstance) {
    rawClientInstance = createClientForUrl(DEFAULT_DB_URL);
    if (!isDev && !isDiscovering) {
      isDiscovering = true;
      discoverAndSwapHost().catch(() => {});
    }
  }
  return rawClientInstance;
}

async function discoverAndSwapHost() {
  if (isDev) return;
  for (const host of CANDIDATE_HOSTS) {
    try {
      const ok = await probeHost(host, 5432, 200);
      if (ok) {
        const foundUrl = `postgresql://postgres:${DEFAULT_DB_PASS}@${host}:5432/postgres?schema=public`;
        if (rawClientInstance) {
          await rawClientInstance.$disconnect().catch(() => {});
        }
        rawClientInstance = createClientForUrl(foundUrl);
        console.log(`[db] Connected to PostgreSQL host: ${host}`);
        break;
      }
    } catch {}
  }
}

// Proxy that delegates directly to the underlying raw client instance
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getRawClient();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

let initPromise: Promise<void> | null = null;
let initialized = false;

// Auto-initialize and migrate tables on startup
export async function ensureTables() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!isDev) {
      await discoverAndSwapHost();
    }
    const client = getRawClient();

    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        name TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,

      // Workspaces table
      `CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id TEXT`,
      `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,

      // Custom domains table
      `CREATE TABLE IF NOT EXISTS custom_domains (
        id TEXT PRIMARY KEY,
        domain TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        workspace_id TEXT NOT NULL,
        created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE custom_domains ADD COLUMN IF NOT EXISTS workspace_id TEXT`,
      `ALTER TABLE custom_domains ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,

      // Short URLs table
      `CREATE TABLE IF NOT EXISTS short_urls (
        id TEXT PRIMARY KEY,
        original_url TEXT NOT NULL,
        short_code TEXT UNIQUE NOT NULL,
        clicks_count INTEGER DEFAULT 0,
        workspace_id TEXT NOT NULL,
        domain_id TEXT,
        created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS original_url TEXT`,
      `ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS short_code TEXT`,
      `ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0`,
      `ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS workspace_id TEXT`,
      `ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS domain_id TEXT`,
      `ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,

      // OTP codes table
      `CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        expires_at TIMESTAMP(3) NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        user_id TEXT,
        created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS "otp_codes_email_type_idx" ON otp_codes(email, type)`
    ];

    for (const q of queries) {
      try {
        await client.$executeRawUnsafe(q);
      } catch (e) {
        console.error("[db] Error executing table/migration statement:", e);
      }
    }
    initialized = true;
  })();

  return initPromise;
}
