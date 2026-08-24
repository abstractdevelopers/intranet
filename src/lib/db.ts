import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// One client per Node process — the pooler URL carries connection_limit=1,
// which fits Supabase transaction mode and keeps serverless invocations cheap.
export const db = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = db;
