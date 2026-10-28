//src/app/module/auth/auth.controller.ts
import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync.js";
import { AuthService } from "./auth.service.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { tokenUtils } from "../../utils/token.js";
import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { envVars } from "../../config/env.js";
import { auth } from "../../lib/auth.js";
import { uploadFileToCloudinary } from "../../config/cloudinary.config.js";

const getBetterAuthSession = (req: Request) =>
  auth.api.getSession({
    headers: new Headers({ cookie: req.headers.cookie ?? "" }),
    query: { disableCookieCache: true },
  });

const registerUser = catchAsync(async (req: Request, res: Response) => {
  // ✅ File থাকলে Cloudinary তে upload করুন
  let imageUrl: string | undefined;

  const files = req.files as { [fieldName: string]: Express.Multer.File[] } | undefined;

  if (files?.profilePhoto?.[0]) {
    const file = files.profilePhoto[0];
    const uploadResult = await uploadFileToCloudinary(file.buffer, file.originalname);
    imageUrl = uploadResult.secure_url;
  }

  const result = await AuthService.registerUSer(req.body, imageUrl);

  const { accessToken, refreshToken, token, ...rest } = result;

  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);

  sendResponse(res, {
    httpCode: 201,
    success: true,
    message: "User created successfully",
    data: {
      ...rest,
      accessToken,
      refreshToken,
      token,
    },
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.loginUser(req.body);

  const { accessToken, refreshToken, token, sessionCookie, ...rest } = result;

  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);
  tokenUtils.setBetterAuthSessionCookie(res, sessionCookie);

  sendResponse(res, {
    httpCode: 200,
    success: true,
    message: "Login successful",
    data: {
      ...rest,
      accessToken,
      refreshToken,
      token,
    },
  });
});

// =====================
// 🔥 FIXED GET ME
// =====================
const getMe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;

  const result = await AuthService.getMe(userId);

  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});
const getNewToken = catchAsync(
    async (req: Request, res: Response) => {
        const refreshToken = req.cookies.refreshToken;
        const session = await getBetterAuthSession(req);
        if (!session) {
            throw new AppError(status.UNAUTHORIZED, "Invalid session");
        }
        if (!refreshToken) {
            throw new AppError(status.UNAUTHORIZED, "Refresh token is missing");
        }
        const result = await AuthService.getNewToken(refreshToken, session.session.token);

        const { accessToken, refreshToken: newRefreshToken, sessionToken } = result;

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, newRefreshToken);
        sendResponse(res, {
            httpCode: status.OK,
            success: true,
            message: "New tokens generated successfully",
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                sessionToken,
            },
        });
    }
)
const changePassword = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const session = await getBetterAuthSession(req);

    const result = await AuthService.changePassword(
        payload,
        session?.session.token,
        req.user.userId
    );

    const { accessToken, refreshToken, token: newSessionToken, ...rest } = result;

    tokenUtils.setAccessTokenCookie(res, accessToken);
    tokenUtils.setRefreshTokenCookie(res, refreshToken);

    if (!newSessionToken) {
        tokenUtils.clearBetterAuthSessionCookie(res);
    }

    sendResponse(res, {
        httpCode: status.OK,
        success: true,
        message: "Password changed successfully",
        data: {
            ...rest,
            accessToken,
            refreshToken,
            token: newSessionToken,
        },
    });
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
  const session = await getBetterAuthSession(req);

  const data = await AuthService.logoutUser(session?.session.token);

  tokenUtils.clearAccessTokenCookie(res);
  tokenUtils.clearRefreshTokenCookie(res);
  tokenUtils.clearBetterAuthSessionCookie(res);

  sendResponse(res, {
    httpCode: status.OK,
    success: true,
    message: "Logged out successfully",
    data,
  });
});

const verifyEmail = catchAsync(
    async (req: Request, res: Response) => {
        const { email, otp } = req.body;
        await AuthService.verifyEmail(email, otp);

        sendResponse(res, {
            httpCode: status.OK,
            success: true,
            message: "Email verified successfully",
        });
    }
)
const forgetPassword = catchAsync(
  async (req: Request, res: Response) => {
      const { email } = req.body;
      await AuthService.forgetPassword(email);

      sendResponse(res, {
          httpCode: status.OK,
          success: true,
          message: "Password reset OTP sent to email successfully",
      });
  }
)
const resetPassword = catchAsync(
  async (req: Request, res: Response) => {
      const { email, otp, newPassword } = req.body;
      await AuthService.resetPassword(email, otp, newPassword);

      sendResponse(res, {
          httpCode: status.OK,
          success: true,
          message: "Password reset successfully",
      });
  }
)
const googleLogin = catchAsync((req: Request, res: Response) => {
  const redirectPath = (req.query.redirect as string) || "/dashboard";

  const encodedRedirectPath = encodeURIComponent(redirectPath);

  const callbackURL = `${new URL(envVars.BETTER_AUTH_URL).origin}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;

  const html = `
    <html>
      <body>
        <p>Redirecting to Google...</p>

        <script>
          fetch("${envVars.BETTER_AUTH_URL}/sign-in/social", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
              provider: "google",
              callbackURL: "${callbackURL}"
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data.url) {
              window.location.href = data.url;
            } else {
              document.body.innerHTML = "Failed to redirect";
            }
          })
          .catch(err => {
            document.body.innerHTML = err.message;
          });
        </script>
      </body>
    </html>
  `;

  return res.send(html);
});

const googleLoginSuccess = catchAsync(async (req: Request, res: Response) => {
  const sessionToken = req.cookies["better-auth.session_token"] || req.cookies["__Secure-better-auth.session_token"];

  if (!sessionToken) {
    return res.redirect(`${envVars.FRONTEND_URL}/?login=error`);
  }

 const session = await getBetterAuthSession(req);

  if (!session || !session.user) {
    return res.redirect(`${envVars.FRONTEND_URL}/?login=error`);
  }

  const result = await AuthService.googleLoginSuccess(session);

  const { accessToken, refreshToken } = result;

  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);

  return res.redirect(`${envVars.FRONTEND_URL}/?login=success`);
});

const handleOAuthError = catchAsync((req: Request, res: Response) => {
  const error = req.query.error as string || "oauth_failed";
  res.redirect(`${envVars.FRONTEND_URL}/login?error=${error}`);
})
export const AuthController = {
  registerUser,
  loginUser,
  getMe,
  getNewToken,
  changePassword,
  logoutUser,
  verifyEmail,
  forgetPassword,
  resetPassword,
  googleLogin,
  googleLoginSuccess,
  handleOAuthError,
};