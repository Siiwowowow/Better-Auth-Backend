import { Router } from "express";
import { AuthController } from "./auth.controller";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/browser";

const router = Router();

router.post("/register", AuthController.registerUser);
router.post("/login", AuthController.loginUser);
router.post("/logout", AuthController.logoutUser);
router.get("/me", checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.USER), AuthController.getMe)
router.post("/refresh-token", AuthController.getNewToken)
router.post(
  "/change-password",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  AuthController.changePassword
);
router.post("/verify-email", AuthController.verifyEmail);
router.post("/forget-password", AuthController.forgetPassword);
router.post("/reset-password", AuthController.resetPassword);
router.get("/login/google", AuthController.googleLogin);
router.get("/google/success", AuthController.googleLoginSuccess);
router.get("/oauth/error", AuthController.handleOAuthError);
export const AuthRouters = router;