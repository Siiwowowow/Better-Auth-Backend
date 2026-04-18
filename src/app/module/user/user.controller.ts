// src/modules/user/user.controller.ts

import { Request, Response } from "express";
import status from "http-status";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { UserService } from "./user.service";
import { prisma } from "../../lib/prisma";
import { deleteFileFromCloudinary } from "../../config/cloudinary.config";

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const payload = req.body;

  const result = await UserService.updateMyProfile(user, payload);

  sendResponse(res, {
    success: true,
    httpCode: status.OK,
    message: "Profile updated successfully",
    data: result,
  });
});

const removeProfilePhoto = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const existingUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.userId },
  });

  if (existingUser.image) {
    // Delete from Cloudinary
    await deleteFileFromCloudinary(existingUser.image);
    
    // Update database to remove image
    await prisma.user.update({
      where: { id: user.userId },
      data: { image: null },
    });
  }

  sendResponse(res, {
    success: true,
    httpCode: status.OK,
    message: "Profile photo removed successfully",
  });
});

export const UserController = {
  updateMyProfile,
  removeProfilePhoto,
};