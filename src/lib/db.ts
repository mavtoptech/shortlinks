import { PrismaClient } from "@prisma/client";
import net from "node:net";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initialized?: boolean;
  resolvedDbUrl?: string;
};

const DEFAULT_DB_PASS = "yGDAmEITo1SsVHKS9JtwcWbkxAmdU9MR";
const DEFAULT_DB_URL = process.env.DATABASE_URL || `postgresql://postgres:${DEFAULT_DB_PASS}@supabase-db:5432/postgres?schema=public`;

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

// Fast TCP probe to find reachable DB host (< 50ms)
function probeHost(host: string, port = 5432, timeoutMs = 400): Promise<boolean> {
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

let clientPromise: Promise<PrismaClient> | null = null;

async function getOrInitPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  let activeUrl = DEFAULT_DB_URL;

  // In production / container environment, discover working host
  for (const host of CANDIDATE_HOSTS) {
    try {
      const isReachable = await probeHost(host, 5432, 300);
      if (isReachable) {
        console.log(`[db] Found reachable PostgreSQL host: ${host}`);
        activeUrl = `postgresql://postgres:${DEFAULT_DB_PASS}@${host}:5432/postgres?schema=public`;
        break;
      }
    } catch {
      // Continue to next candidate
    }
  }

  globalForPrisma.resolvedDbUrl = activeUrl;
  globalForPrisma.prisma = new PrismaClient({
    datasources: {
      db: {
        url: activeUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return globalForPrisma.prisma;
}

// Proxy export so all callers (prisma.user, prisma.shortUrl, etc.) use the active client
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      // Synchronous fallback client while probe resolves
      globalForPrisma.prisma = new PrismaClient({
        datasources: { db: { url: globalForPrisma.resolvedDbUrl || DEFAULT_DB_URL } },
        log: ["error"],
      });
    }
    const val = (globalForPrisma.prisma as any)[prop];
    return typeof val === "function" ? val.bind(globalForPrisma.prisma) : val;
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let initPromise: Promise<void> | null = null;

// Auto-initialize tables on startup if they don't exist
export async function ensureTables() {
  if (globalForPrisma.initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Ensure active client with working host
    const client = await getOrInitPrisma();

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
    globalForPrisma.initialized = true;
  })();

  return initPromise;
}

// Kick off immediately on module load
ensureTables().catch(() => {});
