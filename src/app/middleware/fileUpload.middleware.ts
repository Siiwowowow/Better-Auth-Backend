// src/middleware/fileUpload.middleware.ts

import { Request, Response, NextFunction } from "express";
import { multerUpload } from "../config/multer.config";

// Simple middleware that accepts both field names
export const handleProductPhotoUpload = (req: Request, res: Response, next: NextFunction) => {
  const upload = multerUpload.fields([
    { name: "productPhoto", maxCount: 1 },
    { name: "file", maxCount: 1 }
  ]);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upload(req, res, (error: any) => {
    if (error) {
      // If it's an unexpected field error, check if there's any file uploaded
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        // Try to find any file in the request
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const files = (req as any).files || {};
        const anyFileKey = Object.keys(files)[0];
        
        if (anyFileKey && files[anyFileKey] && files[anyFileKey][0]) {
          // Rename the field to productPhoto
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (req as any).files = {
            productPhoto: files[anyFileKey]
          };
          return next();
        }
      }
      return next(error);
    }
    next();
  });
};