import { Router } from "express";
import { Role } from "@prisma/client";
import { checkAuth } from "../../middleware/checkAuth.js"; 
import { validateRequest } from "../../middleware/validateRequest.js";
import { UserController } from "./user.controller.js";
import { updateMyProfileMiddleware } from "./user.middlewares.js";
import { multerUpload } from "../../config/multer.config.js";
import { UserValidation } from "./user.validation.js";

const router = Router();

router.patch(
  "/update-my-profile",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN), // ✅ এটা আগে ছিল না
  multerUpload.fields([{ name: "profilePhoto", maxCount: 1 }]),
  updateMyProfileMiddleware,
  validateRequest(UserValidation.updateUserProfileZodSchema),
  UserController.updateMyProfile
);

router.delete(
  "/remove-profile-photo",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  UserController.removeProfilePhoto
);

export const UserRoutes = router;