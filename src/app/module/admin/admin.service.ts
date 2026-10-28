// src/app/module/admin/admin.service.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import status from "http-status";
import { Role, userStatus } from "@prisma/client";
import { IRequestUser } from "../../interfaces/requestUser.interface.js";
import { prisma } from "../../lib/prisma.js";
import {
  ICreateAdminPayload,
  IUpdateAdminPayload,
  IChangeUserRolePayload,
  IChangeUserStatusPayload,
} from "./admin.interface.js";
import AppError from "../../errorHelpers/AppError.js";

const ensureAdminAuthorization = (currentUser?: IRequestUser) => {
  if (!currentUser || currentUser.role !== Role.ADMIN) {
    throw new AppError(status.FORBIDDEN, "Only active administrators can perform this operation");
  }
};

const getAllAdmins = async () => {
  const admins = await prisma.admin.findMany({
    where: { isDeleted: false },
    include: {
      user: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return admins;
};

const getAdminById = async (id: string) => {
  const admin = await prisma.admin.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!admin) {
    throw new AppError(status.NOT_FOUND, "Admin not found");
  }
  return admin;
};

const createAdmin = async (payload: ICreateAdminPayload, currentUser?: IRequestUser) => {
  ensureAdminAuthorization(currentUser);
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();

  const existingAdmin = await prisma.admin.findUnique({ where: { email } });
  if (existingAdmin && !existingAdmin.isDeleted) {
    throw new AppError(status.CONFLICT, "An admin with this email already exists");
  }

  return prisma.$transaction(async (tx: any) => {
    let user = await tx.user.findUnique({ where: { email } });
    if (!user) {
      user = await tx.user.create({
        data: {
          id: randomUUID(),
          name,
          email,
          role: Role.ADMIN,
          status: userStatus.ACTIVE,
          emailVerified: true,
        },
      });
    } else {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          name,
          role: Role.ADMIN,
          status: userStatus.ACTIVE,
          isDeleted: false,
        },
      });
    }

    const admin = await tx.admin.upsert({
      where: { email },
      update: {
        name,
        profilePhoto: payload.profilePhoto || null,
        contactNumber: payload.contactNumber || null,
        isDeleted: false,
        deletedAt: null,
      },
      create: {
        name,
        email,
        profilePhoto: payload.profilePhoto || null,
        contactNumber: payload.contactNumber || null,
        userId: user.id,
      },
      include: { user: true },
    });

    return admin;
  });
};

const updateAdmin = async (
  id: string,
  payload: IUpdateAdminPayload,
  currentUser?: IRequestUser
) => {
  if (currentUser) ensureAdminAuthorization(currentUser);

  const isAdminExist = await prisma.admin.findUnique({
    where: { id },
  });

  if (!isAdminExist) {
    throw new AppError(status.NOT_FOUND, "Admin not found");
  }

  const adminData = payload.admin || {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.profilePhoto !== undefined ? { profilePhoto: payload.profilePhoto } : {}),
    ...(payload.contactNumber !== undefined ? { contactNumber: payload.contactNumber } : {}),
  };

  const updatedAdmin = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.admin.update({
      where: { id },
      data: {
        ...(adminData.name !== undefined ? { name: adminData.name } : {}),
        ...(adminData.profilePhoto !== undefined
          ? { profilePhoto: adminData.profilePhoto || null }
          : {}),
        ...(adminData.contactNumber !== undefined
          ? { contactNumber: adminData.contactNumber || null }
          : {}),
      },
      include: { user: true },
    });

    if (adminData.name) {
      await tx.user.update({
        where: { id: isAdminExist.userId },
        data: { name: adminData.name },
      });
    }

    return updated;
  });

  return updatedAdmin;
};

const deleteAdmin = async (id: string, user: IRequestUser) => {
  ensureAdminAuthorization(user);

  const isAdminExist = await prisma.admin.findUnique({
    where: { id },
  });

  if (!isAdminExist) {
    throw new AppError(status.NOT_FOUND, "Admin not found");
  }

  if (isAdminExist.id === user.userId || isAdminExist.userId === user.userId) {
    throw new AppError(status.BAD_REQUEST, "You cannot delete your own admin account");
  }

  const result = await prisma.$transaction(async (tx: any) => {
    await tx.admin.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: isAdminExist.userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: userStatus.DELETED,
      },
    });

    await tx.session.deleteMany({
      where: { userId: isAdminExist.userId },
    });

    await tx.account.deleteMany({
      where: { userId: isAdminExist.userId },
    });

    return tx.admin.findUnique({
      where: { id },
      include: { user: true },
    });
  });

  return result;
};

const changeUserStatus = async (
  payload: IChangeUserStatusPayload,
  currentUser: IRequestUser
) => {
  ensureAdminAuthorization(currentUser);

  const { userId, status: nextUserStatus } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (user.id === currentUser.userId) {
    throw new AppError(status.BAD_REQUEST, "You cannot change your own status");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      status: nextUserStatus,
    },
  });

  return updatedUser;
};

const changeUserRole = async (
  payload: IChangeUserRolePayload,
  currentUser: IRequestUser
) => {
  ensureAdminAuthorization(currentUser);

  const { userId, role } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (user.id === currentUser.userId) {
    throw new AppError(status.BAD_REQUEST, "You cannot change your own role");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      role,
    },
  });

  return updatedUser;
};

export const AdminService = {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  changeUserRole,
  changeUserStatus,
};
