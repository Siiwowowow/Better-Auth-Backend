/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";
import { CookieUtils } from "../utils/cookie";
import { jwtUtils } from "../utils/jwt";
import { Role, userStatus } from "../../generated/prisma/enums";

export const checkAuth =
  (...authRoles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionToken = CookieUtils.getCookie(
        req,
        "better-auth.session_token"
      );

      const accessToken = CookieUtils.getCookie(req, "accessToken");

      let user: any = null;

      // =========================
      // 🔥 1. SESSION AUTH (PRIMARY)
      // =========================
      if (sessionToken) {
        const session = await prisma.session.findFirst({
          where: {
            token: sessionToken,
            expiresAt: { gt: new Date() },
          },
          include: {
            user: true,
          },
        });

        if (!session || !session.user) {
          throw new AppError(status.UNAUTHORIZED, "Invalid session token");
        }

        user = session.user;
      }

      // =========================
      // 🔥 2. JWT AUTH (FALLBACK)
      // =========================
      else if (accessToken) {
        const verified = jwtUtils.verifyToken(
          accessToken,
          envVars.ACCESS_TOKEN_SECRET
        );

        if (!verified.success) {
          throw new AppError(status.UNAUTHORIZED, "Invalid access token");
        }

        user = verified.data;
      }

      // =========================
      // ❌ NO AUTH FOUND
      // =========================
      else {
        throw new AppError(
          status.UNAUTHORIZED,
          "Unauthorized access! No token found"
        );
      }

      // =========================
      // 🔥 USER STATUS CHECK
      // =========================
      if (
        user.status === userStatus.PENDING_VERIFICATION ||
        user.status === userStatus.BLOCKED ||
        user.status === userStatus.DELETED ||
        user.isDeleted
      ) {
        if (user.status === userStatus.PENDING_VERIFICATION) {
          throw new AppError(
            status.FORBIDDEN,
            "Account pending verification. Please verify your email to continue"
          );
        }
        throw new AppError(status.UNAUTHORIZED, "User is not active");
      }

      // =========================
      // 🔥 EMAIL VERIFICATION CHECK
      // =========================
      if (!user.emailVerified) {
        throw new AppError(status.FORBIDDEN, "Email verification required. Please verify your email to access this resource");
      }

      // =========================
      // 🔥 ROLE CHECK
      // =========================
      if (authRoles.length > 0 && !authRoles.includes(user.role)) {
        throw new AppError(status.FORBIDDEN, "Forbidden access");
      }

      // =========================
      // 🚀 CLEAN req.user (IMPORTANT ADD)
      // =========================
      req.user = {
        userId: user.id,
        role: user.role,
        email: user.email,
      };

      next();
    } catch (error: any) {
      next(error);
    }
  };