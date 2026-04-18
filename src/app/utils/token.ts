//src/app/utils/token.ts
import { Response } from "express";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { envVars } from "../config/env";
import { CookieUtils } from "./cookie";
import { jwtUtils } from "./jwt";


//Creating access token
const getAccessToken = (payload: JwtPayload) => {
    const accessToken = jwtUtils.createToken(
        payload,
        envVars.ACCESS_TOKEN_SECRET,
        { expiresIn: envVars.ACCESS_TOKEN_EXPIRES_IN } as SignOptions
    );

    return accessToken;
}

const getRefreshToken = (payload: JwtPayload) => {
    const refreshToken = jwtUtils.createToken(
        payload,
        envVars.REFRESH_TOKEN_SECRET,
        { expiresIn: envVars.REFRESH_TOKEN_EXPIRES_IN } as SignOptions
    );
    return refreshToken;
}


const isProduction = process.env.NODE_ENV === "production";

const accessTokenCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 1000,
};

const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 1000 * 7,
};

const setAccessTokenCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, "accessToken", token, accessTokenCookieOptions);
};

const setRefreshTokenCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, "refreshToken", token, refreshTokenCookieOptions);
};

const clearAccessTokenCookie = (res: Response) => {
    CookieUtils.clearCookie(res, "accessToken", {
        httpOnly: accessTokenCookieOptions.httpOnly,
        secure: accessTokenCookieOptions.secure,
        sameSite: accessTokenCookieOptions.sameSite,
        path: accessTokenCookieOptions.path,
    });
};

const clearRefreshTokenCookie = (res: Response) => {
    CookieUtils.clearCookie(res, "refreshToken", {
        httpOnly: refreshTokenCookieOptions.httpOnly,
        secure: refreshTokenCookieOptions.secure,
        sameSite: refreshTokenCookieOptions.sameSite,
        path: refreshTokenCookieOptions.path,
    });
};

const setBetterAuthSessionCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, "better-auth.session_token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: '/',
        //1 day
        maxAge: 60 * 60 * 24 * 1000,
    });
}

const betterAuthSessionCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
};

const clearBetterAuthSessionCookie = (res: Response) => {
    CookieUtils.clearCookie(res, "better-auth.session_token", betterAuthSessionCookieOptions);
}



export const tokenUtils = {
    getAccessToken,
    getRefreshToken,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    clearAccessTokenCookie,
    clearRefreshTokenCookie,
    setBetterAuthSessionCookie,
    clearBetterAuthSessionCookie,
};