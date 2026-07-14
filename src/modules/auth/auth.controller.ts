import { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.config";
import {
    setRefreshTokenCookie,
    clearRefreshTokenCookie,
    REFRESH_TOKEN_COOKIE,
} from "../../utils/cookie.utils";
import { AppError } from "../../utils/AppError";
import * as authService from "./auth.service";
import { AuthUser } from "../../interfaces/auth.interface";

// local auth (email + password)
export const signup = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const user = await authService.signupService(req.body);
        return res.status(201).json({
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

        return res.status(200).json({
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
        return res.status(200).json({
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
        const { user, tokenPair } =
            await authService.refreshService(rawToken);
            
        setRefreshTokenCookie(res, tokenPair.rawRefreshToken);

        return res.status(200).json({
            success: true,
            message: "Access token refreshed successfully.",
            data: { accessToken: tokenPair.accessToken, user },
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
        const user = req.user!;

        return res.status(200).json({
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
        return res.status(200).json({
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

        return res.status(200).json({
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
        const user = req.user as AuthUser;

        const tokens = await authService.issueTokenPair(
            user.id,
            user.name,
            user.email,
            user.plan,
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

// settings: update display name
export const updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const user = await authService.updateProfileService(req.user!.id, req.body);
        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: { user },
        });
    } catch (err) {
        next(err);
    }
};

// settings: change password
export const updatePassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        await authService.updatePasswordService(req.user!.id, req.body);
        return res.status(200).json({
            success: true,
            message: "Password updated successfully.",
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

// settings: get notification preferences
export const getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const preferences = await authService.getNotificationsService(req.user!.id);
        return res.status(200).json({
            success: true,
            message: "Notification preferences retrieved.",
            data: { preferences },
        });
    } catch (err) {
        next(err);
    }
};

// settings: update notification preferences (Pro only)
export const updateNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const preferences = await authService.updateNotificationsService(
            req.user!.id,
            req.user!.plan,
            req.body,
        );
        return res.status(200).json({
            success: true,
            message: "Notification preferences saved.",
            data: { preferences },
        });
    } catch (err) {
        next(err);
    }
};
