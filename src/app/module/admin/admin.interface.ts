// src/app/module/admin/admin.interface.ts
import { Role, userStatus } from "@prisma/client";

export interface ICreateAdminPayload {
  name: string;
  email: string;
  profilePhoto?: string;
  contactNumber?: string;
}

export interface IUpdateAdminPayload {
  admin?: {
    name?: string;
    profilePhoto?: string;
    contactNumber?: string;
  };
  name?: string;
  profilePhoto?: string;
  contactNumber?: string;
}

export interface IChangeUserStatusPayload {
  userId: string;
  status: userStatus;
}

export interface IChangeUserRolePayload {
  userId: string;
  role: Role;
}
