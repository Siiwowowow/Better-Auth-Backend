/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { auth } from "../lib/auth";
import { CookieUtils } from "../utils/cookie";
import { jwtUtils } from "../utils/jwt";
import { Role, userStatus } from "../../generated/prisma/enums";

export const checkAuth =
  (...authRoles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionToken = CookieUtils.getCookie(req, "better-auth.session_token");
      const accessToken = CookieUtils.getCookie(req, "accessToken");

      let user: any = null;

      if (sessionToken) {
        const session = await auth.api.getSession({
          headers: {
            Cookie: `better-auth.session_token=${sessionToken}`,
          },
        });

        if (!session || !session.user) {
          throw new AppError(status.UNAUTHORIZED, "Invalid session token");
        }

        user = session.user; // { id, role, email, ... }
      }

      else if (accessToken) {
        const verified = jwtUtils.verifyToken(accessToken, envVars.ACCESS_TOKEN_SECRET);

        if (!verified.success) {
          throw new AppError(status.UNAUTHORIZED, "Invalid access token");
        }

        user = verified.data; // { userId, role, email, ... }
      }

      else {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized access! No token found");
      }

      const isMeRoute = req.originalUrl.endsWith("/me");

      if (
        user.status === userStatus.BLOCKED ||
        user.status === userStatus.DELETED ||
        user.isDeleted
      ) {
        throw new AppError(status.UNAUTHORIZED, "User is not active");
      }

      if (!isMeRoute && user.status === userStatus.PENDING_VERIFICATION) {
        throw new AppError(status.FORBIDDEN, "Account pending verification. Please verify your email.");
      }

      if (!isMeRoute && !user.emailVerified) {
        throw new AppError(status.FORBIDDEN, "Email verification required.");
      }

      if (authRoles.length > 0 && !authRoles.includes(user.role)) {
        throw new AppError(status.FORBIDDEN, "Forbidden access");
      }

      // ✅ KEY FIX: Session এ `id`, JWT payload এ `userId`
      req.user = {
        userId: user.userId || user.id,
        role: user.role,
        email: user.email,
      };

      next();
    } catch (error: any) {
      next(error);
    }
  };