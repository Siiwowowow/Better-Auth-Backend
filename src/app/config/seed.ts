//src/app/config/seed.ts
//src/app/config/seed.ts
import { Role } from "@prisma/client";
import { envVars } from "../config/env.js";
import { auth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export const seedSuperAdmin = async () => {
  try {
    // 🧹 CLEANUP: Delete duplicate/broken accounts (temporary)
    const cleanup = await prisma.account.deleteMany({
      where: {
        providerId: "credential",
        OR: [
          { password: null },
          { id: { startsWith: "account_" } }
        ]
      }
    });
    if (cleanup.count > 0) {
      console.log(`🧹 Cleaned up ${cleanup.count} broken account records.`);
    }

    // ✅ CHECK IN ADMIN TABLE (BEST SOURCE OF TRUTH)
    const exists = await prisma.admin.findFirst({
      where: {
        email: envVars.SUPER_ADMIN_EMAIL,
      },
    });

    if (exists) {
      console.log("Super admin already exists. Skipping...");
      return;
    }

    // 1️⃣ CREATE USER
    const superAdminUser = await auth.api.signUpEmail({
      body: {
        email: envVars.SUPER_ADMIN_EMAIL,
        password: envVars.SUPER_ADMIN_PASSWORD,
        name: "Super Admin",
        // @ts-ignore - custom fields type issue in seed
        role: Role.SUPER_ADMIN,
        // @ts-ignore
        needPasswordChange: false,
      },
    });

    if (!superAdminUser?.user?.id) {
      throw new Error("Failed to create super admin user");
    }

    // 2️⃣ CREATE ADMIN + USER UPDATE (ATOMIC)
    const result = await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: {
          id: superAdminUser.user.id,
        },
        data: {
          emailVerified: true,
          status: "ACTIVE",
        },
      });

      const admin = await tx.admin.create({
        data: {
          name: "Super Admin",
          email: envVars.SUPER_ADMIN_EMAIL,
          userId: superAdminUser.user.id,
         
        },
      });

      return admin;
    });

    console.log("🔥 Super Admin Created Successfully:", result);
  } catch (error) {
    console.error("❌ Error seeding super admin:", error);
  }
};