import { PrismaClient } from "../generated/prisma/client";

// Workaround для Vercel
function createPrismaClient() {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({
      log: ['error'],
      datasourceUrl: process.env.DATABASE_URL,
    });
  } else {
    return new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}