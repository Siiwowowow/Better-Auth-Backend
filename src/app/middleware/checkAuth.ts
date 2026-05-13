/* eslint-disable @typescript-eslint/no-explicit-any */
//src/app/middleware/checkAuth.ts
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { envVars } from "../config/env.js";
import AppError from "../errorHelpers/AppError.js";
import { auth } from "../lib/auth.js";
import { CookieUtils } from "../utils/cookie.js";
import { jwtUtils } from "../utils/jwt.js";
import { Role, userStatus } from "@prisma/client";

export const checkAuth =
  (...authRoles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionToken = CookieUtils.getCookie(req, "better-auth.session_token");
      const accessToken = CookieUtils.getCookie(req, "accessToken");

      let user: any = null;

      // ✅ Session try — fail হলে JWT try করবে
      if (sessionToken) {
        try {
          const session = await auth.api.getSession({
            headers: {
              Cookie: `better-auth.session_token=${sessionToken}`,
            },
          });
          if (session?.user) {
            user = session.user;
          }
        } catch {
          user = null;
        }
      }

      // ✅ Session না পেলে JWT দিয়ে try
      if (!user && accessToken) {
        const verified = jwtUtils.verifyToken(accessToken, envVars.ACCESS_TOKEN_SECRET);
        if (verified.success) {
          user = verified.data;
        }
      }

      // ✅ দুটোই fail
      if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized access! Please login again.");
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

      // ✅ IRequestUser এর সব fields
      req.user = {
        userId: user.userId || user.id,
        role: user.role,
        email: user.email,
        isDeleted: user.isDeleted ?? false,
        emailVerified: user.emailVerified ?? false,
        status: user.status,
        image: user.image ?? null,
      };

      next();
    } catch (error: any) {
      next(error);
    }
  };