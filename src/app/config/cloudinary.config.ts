import fs from "node:fs";
import path from "node:path";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import status from "http-status";
import AppError from "../errorHelpers/AppError.js";
import { envVars } from "./env.js";

cloudinary.config({
  cloud_name: envVars.CLOUDINARY.CLOUDINARY_CLOUD_NAME,
  api_key: envVars.CLOUDINARY.CLOUDINARY_API_KEY,
  api_secret: envVars.CLOUDINARY.CLOUDINARY_API_SECRET,
});

export const uploadFileToCloudinary = async (
  buffer: Buffer,
  fileName: string
): Promise<UploadApiResponse> => {
  if (!buffer || !fileName) {
    throw new AppError(
      status.BAD_REQUEST,
      "File buffer and file name are required for upload"
    );
  }

  const extension = (fileName.split(".").pop() || "jpg").toLowerCase();
  const fileNameWithoutExtension = fileName
    .split(".")
    .slice(0, -1)
    .join(".")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const uniqueName = `${Math.random().toString(36).substring(2, 8)}-${Date.now()}-${
    fileNameWithoutExtension || "image"
  }`;
  const folder = extension === "pdf" ? "pdfs" : "images";

  try {
    const cloudResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "auto",
            public_id: `an-corporation/${folder}/${uniqueName}`,
            folder: `an-corporation/${folder}`,
          },
          (error, result) => {
            if (error || !result) {
              return reject(error || new Error("Cloudinary upload failed"));
            }
            resolve(result as UploadApiResponse);
          }
        )
        .end(buffer);
    });
    return cloudResult;
  } catch (cloudError) {
    console.warn(
      "Cloudinary upload fallback to local static storage:",
      (cloudError as Error)?.message || cloudError
    );
    const uploadsDir = path.resolve(process.cwd(), "uploads", folder);
    fs.mkdirSync(uploadsDir, { recursive: true });
    const savedFileName = `${uniqueName}.${extension}`;
    const filePath = path.join(uploadsDir, savedFileName);
    fs.writeFileSync(filePath, buffer);

    const baseUrl = `http://localhost:${envVars.PORT || 5000}`;
    const fileUrl = `${baseUrl}/uploads/${folder}/${savedFileName}`;

    return {
      secure_url: fileUrl,
      url: fileUrl,
      public_id: `local/${folder}/${uniqueName}`,
      original_filename: fileName,
      format: extension,
      bytes: buffer.length,
    } as unknown as UploadApiResponse;
  }
};

export const deleteFileFromCloudinary = async (url: string) => {
  try {
    if (url.includes("/uploads/")) {
      const rel = url.split("/uploads/")[1];
      if (rel) {
        const localPath = path.resolve(process.cwd(), "uploads", rel);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
      return;
    }

    const regex = /\/v\d+\/(.+?)(?:\.[a-zA-Z0-9]+)+$/;
    const match = url.match(regex);
    if (match && match[1]) {
      const publicId = match[1];
      await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      });
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

export const cloudinaryUpload = cloudinary;