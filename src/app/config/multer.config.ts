import multer from "multer";

const storage = multer.memoryStorage();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fileFilter = (_req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif|avif|svg/;
  const extname = allowedTypes.test(file.originalname.toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype.toLowerCase());

  if (extname || mimetype) {
    return cb(null, true);
  }
  cb(new Error("Only image files (jpeg, jpg, png, webp, gif, avif, svg) are allowed"));
};

export const multerUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
  },
  fileFilter,
});
