import { Request, Response, NextFunction } from "express";
import passport from "../config/passport.config";
import { env } from "../config/env.config";

export const googleAuth = passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
});

export const googleAuthCallback = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    passport.authenticate(
        "google",
        { session: false },
        (err: Error | null, result: unknown) => {
            if (err) return next(err);
            if (!result) {
                return res.redirect(
                    `${env.FRONTEND_URL}/auth/callback?error=${encodeURIComponent(
                        "Google sign-in failed. Please try again.",
                    )}`,
                );
            }
            req.user = result as Express.Request["user"];
            next();
        },
    )(req, res, next);
};

export const githubAuth = passport.authenticate("github", {
    session: false,
    scope: ["user:email"],
});

export const githubAuthCallback = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    passport.authenticate(
        "github",
        { session: false },
        (err: Error | null, result: unknown) => {
            if (err) return next(err);
            if (!result) {
                return res.redirect(
                    `${env.FRONTEND_URL}/auth/callback?error=${encodeURIComponent(
                        "GitHub sign-in failed. Please try again.",
                    )}`,
                );
            }
            req.user = result as Express.Request["user"];
            next();
        },
    )(req, res, next);
};
