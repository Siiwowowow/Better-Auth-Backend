//src/app/module/admin/admin.interface.ts
import { Role, userStatus } from "@prisma/client"; // Import from your generated Prisma enums

export interface IUpdateAdminPayload {
    admin?: {
        name?: string;
        profilePhoto?: string;
        contactNumber?: string;
    }
}

export interface IChangeUserStatusPayload {
    userId: string;
    status: userStatus; // Changed from userStatus to status to match service usage
}

export interface IChangeUserRolePayload {
    userId: string;
    role: Role; // Use Role from your generated Prisma enums, not from better-auth
}