// src/utils/fileCleanup.ts

import { deleteFileFromCloudinary } from "../config/cloudinary.config";



export interface IFileCleanupOptions {
  onError?: (error: Error, url: string) => void;
  onSuccess?: (url: string) => void;
}

/**
 * Clean up uploaded files manually
 */
export const cleanupFiles = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  files: any,
  options?: IFileCleanupOptions
): Promise<{ success: string[]; failed: string[] }> => {
  const urls: string[] = [];
  const success: string[] = [];
  const failed: string[] = [];

  // Extract URLs from various file structures
  if (Array.isArray(files)) {
    files.forEach(file => {
      if (file.path) urls.push(file.path);
    });
  } else if (files && typeof files === 'object') {
    if (files.path) {
      urls.push(files.path);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.values(files).forEach((value: any) => {
        if (Array.isArray(value)) {
          value.forEach(file => {
            if (file.path) urls.push(file.path);
          });
        } else if (value?.path) {
          urls.push(value.path);
        }
      });
    }
  }

  // Delete files
  await Promise.all(
    urls.map(async (url) => {
      try {
        await deleteFileFromCloudinary(url);
        success.push(url);
        options?.onSuccess?.(url);
      } catch (error) {
        failed.push(url);
        options?.onError?.(error as Error, url);
      }
    })
  );

  return { success, failed };
};