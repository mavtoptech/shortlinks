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

// Auto-initialize tables on startup if they don't exist
export async function ensureTables() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!isDev) {
      await discoverAndSwapHost();
    }
    const client = getRawClient();

    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        name TEXT,
        "emailVerified" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        "ownerId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS custom_domains (
        id TEXT PRIMARY KEY,
        domain TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        "workspaceId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS short_urls (
        id TEXT PRIMARY KEY,
        "originalUrl" TEXT NOT NULL,
        "shortCode" TEXT UNIQUE NOT NULL,
        "clicksCount" INTEGER DEFAULT 0,
        "workspaceId" TEXT NOT NULL,
        "domainId" TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        "userId" TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS "otp_codes_email_type_idx" ON otp_codes(email, type)`
    ];

    for (const q of queries) {
      try {
        await client.$executeRawUnsafe(q);
      } catch (e) {
        console.error("[db] Error executing table statement:", e);
      }
    }
    initialized = true;
  })();

  return initPromise;
}

ensureTables().catch(() => {});
