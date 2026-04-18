// src/modules/user/user.middleware.ts

import { NextFunction, Request, Response } from "express";
import { IUpdateUserProfilePayload } from "./user.interface";
import { uploadFileToCloudinary } from "../../config/cloudinary.config";

export const updateMyProfileMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Parse JSON data if sent as string
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }

    const payload: IUpdateUserProfilePayload = req.body;

    // Handle file upload
    const files = req.files as { 
      [fieldName: string]: Express.Multer.File[] | undefined 
    };

    // If profile photo is uploaded
    if (files?.profilePhoto?.[0]) {
      const file = files.profilePhoto[0];
      
      // Upload to Cloudinary
      const uploadResult = await uploadFileToCloudinary(
        file.buffer,
        file.originalname
      );
      
      // Store the Cloudinary URL
      payload.image = uploadResult.secure_url;
      
      console.log("Profile photo uploaded:", payload.image);
    }

    req.body = payload;
    next();
  } catch (error) {
    next(error);
  }
};