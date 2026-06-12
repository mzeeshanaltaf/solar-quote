import { PrismaClient } from "@/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton so Next.js dev-mode hot reloads don't exhaust the
// (Neon pooled) connection pool with new clients.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
