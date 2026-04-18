//src/app/module/auth/auth.controller.ts
import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { AuthService } from "./auth.service";
import { sendResponse } from "../../shared/sendResponse";
import { tokenUtils } from "../../utils/token";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { envVars } from "../../config/env";
import { auth } from "../../lib/auth";
import { uploadFileToCloudinary } from "../../config/cloudinary.config";

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
  tokenUtils.setBetterAuthSessionCookie(res, token as string);

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

  const { accessToken, refreshToken, token, ...rest } = result;

  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);
  tokenUtils.setBetterAuthSessionCookie(res, token);

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
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];
        if (!refreshToken) {
            throw new AppError(status.UNAUTHORIZED, "Refresh token is missing");
        }
        const result = await AuthService.getNewToken(refreshToken, betterAuthSessionToken);

        const { accessToken, refreshToken: newRefreshToken, sessionToken } = result;

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, newRefreshToken);
        tokenUtils.setBetterAuthSessionCookie(res, sessionToken);

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
    const betterAuthSessionToken = req.cookies["better-auth.session_token"] as
        | string
        | undefined;

    const result = await AuthService.changePassword(
        payload,
        betterAuthSessionToken,
        req.user.userId
    );

    const { accessToken, refreshToken, token: newSessionToken, ...rest } = result;

    tokenUtils.setAccessTokenCookie(res, accessToken);
    tokenUtils.setRefreshTokenCookie(res, refreshToken);

    if (newSessionToken) {
        tokenUtils.setBetterAuthSessionCookie(res, newSessionToken);
    } else {
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
  const sessionToken = req.cookies["better-auth.session_token"] as
    | string
    | undefined;

  const data = await AuthService.logoutUser(sessionToken);

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

  const callbackURL = `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;

  const html = `
    <html>
      <body>
        <p>Redirecting to Google...</p>

        <script>
          fetch("${envVars.BETTER_AUTH_URL}/api/auth/sign-in/social", {
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
  const sessionToken = req.cookies["better-auth.session_token"];

  if (!sessionToken) {
    return res.redirect(`${envVars.FRONTEND_URL}/?login=error`);
  }

 const session = await auth.api.getSession({
  headers: {
    Cookie: `better-auth.session_token=${sessionToken}`,
  },
});

console.log("GOOGLE SESSION:", session?.user); // 🔥 DEBUG (temporary)

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