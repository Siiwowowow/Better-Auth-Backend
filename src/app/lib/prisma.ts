import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { envVars } from "../config/env.js";

const connectionString = envVars.DATABASE_URL;

const adapter = new PrismaPg({
  connectionString,
  max: 15,
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 30000,
});

const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: 20000,
    timeout: 45000,
  },
});

export { prisma };
