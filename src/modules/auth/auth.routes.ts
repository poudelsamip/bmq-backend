import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import {
    googleAuth,
    googleAuthCallback,
    githubAuth,
    githubAuthCallback,
} from "../../middleware/passport.middleware";
import {
    signupSchema,
    loginSchema,
    verifyEmailSchema,
    resendVerificationSchema,
} from "./auth.schema";
import * as controller from "./auth.controller";

const router = Router();

// rate limit for authentication
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 20, // 20 requests max for windowMS
    message: {
        success: false,
        message: "Too many login attempts, please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/signup", validate(signupSchema), controller.signup);

router.post("/login", validate(loginSchema), controller.login);

router.post("/logout", controller.logout);

router.post("/refresh", controller.refresh);

router.get("/me", authenticate, controller.getMe);

router.post(
    "/verify-email",
    validate(verifyEmailSchema),
    controller.verifyEmail,
);

router.post(
    "/resend-verification",
    validate(resendVerificationSchema),
    controller.resendVerification,
);

router.get("/google", googleAuth);
router.get("/google/callback", googleAuthCallback, controller.googleCallback);

router.get("/github", githubAuth);
router.get("/github/callback", githubAuthCallback, controller.githubCallback);

export default router;
