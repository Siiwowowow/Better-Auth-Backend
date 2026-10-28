/* eslint-disable @typescript-eslint/no-explicit-any */
import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { envVars } from "../config/env.js";
import { jwtUtils } from "../utils/jwt.js";
import { auth } from "../lib/auth.js";

export type GraphQLUser = { userId: string; role: Role; email: string; status?: string; isDeleted?: boolean; emailVerified?: boolean };
export type GraphQLContext = { user: GraphQLUser | null; sessionToken?: string; response?: Response };

export const createGraphQLContext = async (initialContext: any): Promise<GraphQLContext> => {
  const request = initialContext.request ?? initialContext;
  const response = (initialContext.req as (Request & { graphqlResponse?: Response }) | undefined)?.graphqlResponse;
  const authorization = request.headers?.get?.("authorization") ?? request.headers?.authorization;
  const cookieHeader = request.headers?.get?.("cookie") ?? request.headers?.cookie ?? "";
  if (/(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookieHeader)) {
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }), query: { disableCookieCache: true } });
    if (!session || session.user.isDeleted || session.user.status !== "ACTIVE") return { user: null, response };
    return { sessionToken: session.session.token, response, user: { userId: session.user.id, role: session.user.role as Role, email: session.user.email, status: session.user.status, isDeleted: session.user.isDeleted, emailVerified: session.user.emailVerified } };
  }
  const cookieToken = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/)?.[1];
  const token = cookieToken ?? authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return { user: null, response };
  const verified = jwtUtils.verifyToken(token, envVars.ACCESS_TOKEN_SECRET);
  if (!verified.success || !verified.data?.userId) return { user: null, response };
  return { response, user: { userId: verified.data.userId as string, role: verified.data.role as Role, email: verified.data.email as string, status: verified.data.status as string, isDeleted: Boolean(verified.data.isDeleted), emailVerified: Boolean(verified.data.emailVerified) } };
};
