import { PrismaClient } from "@prisma/client";
import net from "node:net";

const DEFAULT_DB_PASS = "yGDAmEITo1SsVHKS9JtwcWbkxAmdU9MR";
const DEFAULT_DB_URL =
  process.env.DATABASE_URL ||
  `postgresql://postgres:${DEFAULT_DB_PASS}@supabase-db:5432/postgres?schema=public`;

// Candidate hostnames inside Coolify Docker network
const CANDIDATE_HOSTS = [
  "2l4llui824evqnplabkdpx9k",
  "supabase-db-yword0jwkztgpiaha6g8ddou",
  "supabase-db-2l4llui824evqnplabkdpx9k",
  "supabase-db",
  "yword0jwkztgpiaha6g8ddou-supabase-db",
  "localhost",
  "127.0.0.1",
];

function probeHost(host: string, port = 5432, timeoutMs = 300): Promise<boolean> {
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

// Store the actual raw PrismaClient instances separately from any global proxy
let rawClientInstance: PrismaClient | null = null;
let isDiscovering = false;

function createClientForUrl(url: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getRawClient(): PrismaClient {
  if (!rawClientInstance) {
    rawClientInstance = createClientForUrl(DEFAULT_DB_URL);
    // Asynchronously discover better host if in container
    if (!isDiscovering) {
      isDiscovering = true;
      discoverAndSwapHost().catch(() => {});
    }
  }
  return rawClientInstance;
}

async function discoverAndSwapHost() {
  for (const host of CANDIDATE_HOSTS) {
    try {
      const ok = await probeHost(host, 5432, 250);
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

// Proxy that delegates directly to the underlying raw client instance (NO recursion)
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
    // Wait for host discovery first
    await discoverAndSwapHost();
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

// Kick off immediately on module load
ensureTables().catch(() => {});
