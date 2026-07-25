import { Response } from "express";
import { env } from "../config/env.config";
import { parseDuration } from "./jwt.utils";

export const REFRESH_TOKEN_COOKIE = "refreshToken";

export const setRefreshTokenCookie = (res: Response, token: string): void => {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: parseDuration(env.JWT_REFRESH_EXPIRES_IN),
        path: "/",
    });
};

export const clearRefreshTokenCookie = (res: Response): void => {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
    });
};
