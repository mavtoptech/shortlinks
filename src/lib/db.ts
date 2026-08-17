import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initialized?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let initPromise: Promise<void> | null = null;

// Auto-initialize tables on startup if they don't exist
export async function ensureTables() {
  if (globalForPrisma.initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
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
        await prisma.$executeRawUnsafe(q);
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
