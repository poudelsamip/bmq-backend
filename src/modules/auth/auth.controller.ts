import { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.config";
import {
    setRefreshTokenCookie,
    clearRefreshTokenCookie,
    REFRESH_TOKEN_COOKIE,
} from "../../utils/cookie.utils";
import { AppError } from "../../utils/AppError";
import * as authService from "./auth.service";

// local auth (email + password)
export const signup = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { user } = await authService.signupService(req.body);
        res.status(201).json({
            success: true,
            message:
                "Account created. Please check your email for a verification code.",
            data: { user },
        });
    } catch (err) {
        next(err);
    }
};

export const login = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const result = await authService.loginService(req.body);

        if ("requiresVerification" in result) {
            res.status(200).json({
                success: false,
                message:
                    "Email not verified. A verification code has been sent to your email.",
                requiresVerification: true,
                data: null,
            });
            return;
        }

        const { user, accessToken, rawRefreshToken } = result;

        setRefreshTokenCookie(res, rawRefreshToken);

        res.status(200).json({
            success: true,
            message: "Logged in successfully.",
            data: { accessToken, user },
        });
    } catch (err) {
        next(err);
    }
};

export const logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const rawToken = req.cookies[REFRESH_TOKEN_COOKIE] as
            | string
            | undefined;
        if (rawToken) await authService.logoutService(rawToken);
        clearRefreshTokenCookie(res);
        res.status(200).json({
            success: true,
            message: "Logged out successfully.",
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

export const refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const rawToken = req.cookies[REFRESH_TOKEN_COOKIE] as
            | string
            | undefined;
        if (!rawToken) {
            return next(
                new AppError(401, "No refresh token provided. Please log in."),
            );
        }
        const { accessToken, rawRefreshToken } =
            await authService.refreshService(rawToken);
        setRefreshTokenCookie(res, rawRefreshToken);
        res.status(200).json({
            success: true,
            message: "Access token refreshed successfully.",
            data: { accessToken },
        });
    } catch (err) {
        next(err);
    }
};

export const getMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.user!.id;
        const user = await authService.getMeService(userId);
        res.status(200).json({
            success: true,
            message: "Profile retrieved successfully.",
            data: { user },
        });
    } catch (err) {
        next(err);
    }
};

// email verification
export const verifyEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { user, accessToken, rawRefreshToken } =
            await authService.verifyEmailService(req.body);
        setRefreshTokenCookie(res, rawRefreshToken);
        res.status(200).json({
            success: true,
            message: "Email verified successfully.",
            data: { accessToken, user },
        });
    } catch (err) {
        next(err);
    }
};

export const resendVerification = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        await authService.resendVerificationService(req.body);
        res.status(200).json({
            success: true,
            message:
                "If an unverified account exists for this email, a new code has been sent.",
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

// oauth callbacks

// shared for both google and github callbacks
const handleOAuthCallback = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const result = req.user as authService.SafeUser;
        const tokens = await authService.issueTokenPair(
            result.id,
            result.email,
        );
        setRefreshTokenCookie(res, tokens.rawRefreshToken);

        // make frontend call POST /api/auth/refresh immediately to get access token.
        res.redirect(`${env.FRONTEND_URL}/auth/callback`);
    } catch (err) {
        next(err);
    }
};

export const googleCallback = handleOAuthCallback;
export const githubCallback = handleOAuthCallback;
