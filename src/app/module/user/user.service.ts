// src/modules/user/user.service.ts

import { deleteFileFromCloudinary } from "../../config/cloudinary.config";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { IUpdateUserProfilePayload } from "./user.interface";

const updateMyProfile = async (
  user: IRequestUser,
  payload: IUpdateUserProfilePayload
) => {
  // Get existing user
  const existingUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.userId },
  });

  // Prepare update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};

  // Add fields only if they are provided
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.email !== undefined) updateData.email = payload.email;
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.address !== undefined) updateData.address = payload.address;
  if (payload.city !== undefined) updateData.city = payload.city;
  if (payload.country !== undefined) updateData.country = payload.country;

  // Handle image update
  if (payload.image) {
    // Delete old image from Cloudinary if it exists
    if (existingUser.image) {
      try {
        await deleteFileFromCloudinary(existingUser.image);
        console.log("Old profile photo deleted:", existingUser.image);
      } catch (error) {
        console.error("Failed to delete old image:", error);
        // Continue with update even if deletion fails
      }
    }
    updateData.image = payload.image;
  }

  // Update the user
  const updatedUser = await prisma.user.update({
    where: { id: existingUser.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      status: true,
      phone: true,
      address: true,
      city: true,
      country: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

export const UserService = {
  updateMyProfile,
};