import { PrismaClient } from "@/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton so Next.js dev-mode hot reloads don't exhaust the
// (Neon pooled) connection pool with new clients.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // node-pg's connection-string parser warns that `sslmode=require` will change
  // meaning in a future major. We keep `sslmode=require` in DATABASE_URL (the
  // Prisma migration engine needs it) but strip it from the string handed to
  // node-pg and configure TLS explicitly — Neon serves a publicly-trusted cert,
  // so verifying it (rejectUnauthorized: true) matches the secure default.
  const url = process.env.DATABASE_URL ?? "";
  const connectionString = url.replace(/([?&])sslmode=[^&]*(&|$)/i, (_m, pre, post) =>
    post === "&" ? pre : ""
  );

  const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
