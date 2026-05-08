import { createHash } from "crypto";
import { AppDataSource } from "../../config/db.config";
import { User, AuthProvider, Plans } from "../../entities/User.entity";
import { RefreshToken } from "../../entities/RefreshToken.entity";
import { AppError } from "../../utils/AppError";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    getRefreshTokenExpiry,
} from "../../utils/jwt.utils";
import {
    generateOtp,
    hashOtp,
    OTP_EXPIRES_MS,
    RESEND_COOLDOWN_MS,
} from "../../utils/otp.utils";
import { sendVerificationEmail } from "../../utils/email.utils";
import type {
    SignupDto,
    LoginDto,
    VerifyEmailDto,
    ResendVerificationDto,
} from "./auth.schema";

import bcrypt from "bcryptjs";
import { AuthUser } from "../../interfaces/auth.interface";

const userRepo = () => AppDataSource.getRepository(User);
const tokenRepo = () => AppDataSource.getRepository(RefreshToken);

const MAX_OTP_ATTEMPTS = 5;

const PROVIDER_LABEL: Record<string, string> = {
    local: "email and password",
    google: "Google",
    github: "GitHub",
};

// helpers
const sha256 = (value: string): string =>
    createHash("sha256").update(value).digest("hex");

const sanitize = (user: User): AuthUser => ({
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
});

export interface TokenPair {
    accessToken: string;
    rawRefreshToken: string;
}

export const issueTokenPair = async (
    userId: string,
    name: string,
    email: string,
    plan: Plans,
): Promise<TokenPair> => {
    const accessToken = generateAccessToken(userId, name, email, plan);
    const rawRefreshToken = generateRefreshToken(userId);

    await tokenRepo().save(
        tokenRepo().create({
            tokenHash: sha256(rawRefreshToken),
            userId,
            expiresAt: getRefreshTokenExpiry(),
            isRevoked: false,
        }),
    );

    return { accessToken, rawRefreshToken };
};

const issueAndSendOtp = async (user: User): Promise<User> => {
    const otp = generateOtp();
    const now = new Date();

    user.emailVerificationCode = hashOtp(otp);
    user.emailVerificationExpires = new Date(now.getTime() + OTP_EXPIRES_MS);
    user.emailVerificationLastSentAt = now;
    user.emailVerificationAttempts = 0; // reset attempts on new OTP

    const saved = await userRepo().save(user);
    await sendVerificationEmail(user.email, otp);
    return saved;
};

//service functions

//signup

export const signupService = async (dto: SignupDto): Promise<AuthUser> => {
    const existing = await userRepo().findOne({ where: { email: dto.email } });

    if (existing) {
        if (existing.authProvider === AuthProvider.LOCAL) {
            throw new AppError(
                409,
                "An account with this email already exists. Please log in instead.",
            );
        }
        const label =
            PROVIDER_LABEL[existing.authProvider] ?? existing.authProvider;
        throw new AppError(
            409,
            `This email is already linked to a ${label} account. Please sign in with ${label} instead.`,
        );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    let user = await userRepo().save(
        userRepo().create({
            name: dto.name,
            email: dto.email,
            password: passwordHash,
            authProvider: AuthProvider.LOCAL,
            providerId: null,
            isEmailVerified: false,
        }),
    );

    user = await issueAndSendOtp(user);
    const sanitizedUser = sanitize(user);

    return sanitizedUser;
};

// login

export type LoginResult =
    | ({ user: AuthUser } & TokenPair)
    | { requiresVerification: true };

export const loginService = async (dto: LoginDto): Promise<LoginResult> => {
    const user = await userRepo()
        .createQueryBuilder("user")
        .addSelect("user.password")
        .addSelect("user.emailVerificationCode")
        .addSelect("user.emailVerificationExpires")
        .where("user.email = :email", { email: dto.email })
        .getOne();

    if (!user) {
        throw new AppError(401, "Invalid email or password.");
    }

    if (user.authProvider !== AuthProvider.LOCAL) {
        const label = PROVIDER_LABEL[user.authProvider] ?? user.authProvider;
        throw new AppError(
            401,
            `This email is registered with ${label}. Please sign in with ${label} instead.`,
        );
    }

    const isValid = await bcrypt.compare(dto.password, user.password!);
    if (!isValid) {
        throw new AppError(401, "Invalid email or password.");
    }

    // if email not verified
    if (!user.isEmailVerified) {
        const otpStillValid =
            user.emailVerificationCode &&
            user.emailVerificationExpires &&
            user.emailVerificationExpires > new Date();

        if (!otpStillValid) {
            await issueAndSendOtp(user);
        }
        return { requiresVerification: true };
    }

    const tokens = await issueTokenPair(
        user.id,
        user.name,
        user.email,
        user.plan,
    );
    return { user: sanitize(user), ...tokens };
};

export const verifyEmailService = async (
    dto: VerifyEmailDto,
): Promise<{ user: AuthUser } & TokenPair> => {
    const user = await userRepo()
        .createQueryBuilder("user")
        .addSelect("user.emailVerificationCode")
        .addSelect("user.emailVerificationExpires")
        .where("user.email = :email", { email: dto.email })
        .getOne();

    if (!user) {
        throw new AppError(404, "No account found with this email address.");
    }

    if (user.isEmailVerified) {
        throw new AppError(
            400,
            "This email address has already been verified.",
        );
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
        throw new AppError(
            400,
            "No verification code found. Please request a new one.",
        );
    }

    if (user.emailVerificationExpires < new Date()) {
        throw new AppError(
            400,
            "Verification code has expired. Please request a new one.",
        );
    }

    // Brute-force protection: lock out after MAX_OTP_ATTEMPTS wrong guesses
    if (user.emailVerificationAttempts >= MAX_OTP_ATTEMPTS) {
        throw new AppError(
            429,
            "Too many failed attempts. Please request a new verification code.",
        );
    }

    if (user.emailVerificationCode !== hashOtp(dto.code)) {
        user.emailVerificationAttempts =
            (user.emailVerificationAttempts ?? 0) + 1;
        await userRepo().save(user);
        throw new AppError(400, "Invalid verification code.");
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;
    user.emailVerificationLastSentAt = null;
    user.emailVerificationAttempts = 0;
    await userRepo().save(user);

    const tokens = await issueTokenPair(
        user.id,
        user.name,
        user.email,
        user.plan,
    );
    return { user: sanitize(user), ...tokens };
};

export const resendVerificationService = async (dto: ResendVerificationDto) => {
    const user = await userRepo().findOne({ where: { email: dto.email } });

    if (!user) {
        // response with success if no user
        return;
    }

    if (user.isEmailVerified) {
        throw new AppError(
            400,
            "This email address has already been verified.",
        );
    }

    if (
        user.emailVerificationLastSentAt &&
        Date.now() - user.emailVerificationLastSentAt.getTime() <
            RESEND_COOLDOWN_MS
    ) {
        const secondsLeft = Math.ceil(
            (RESEND_COOLDOWN_MS -
                (Date.now() - user.emailVerificationLastSentAt.getTime())) /
                1_000,
        );
        throw new AppError(
            429,
            `Please wait ${secondsLeft} seconds before requesting a new code.`,
        );
    }

    await issueAndSendOtp(user);
};

// oauth
export interface OAuthProfile {
    provider: AuthProvider.GOOGLE | AuthProvider.GITHUB;
    providerId: string;
    email: string;
    name: string;
}

export const oauthLoginService = async (
    profile: OAuthProfile,
): Promise<AuthUser> => {
    const existing = await userRepo().findOne({
        where: { email: profile.email },
    });

    if (existing) {
        // email belongs to another login method
        if (existing.authProvider !== profile.provider) {
            const existingLabel =
                PROVIDER_LABEL[existing.authProvider] ?? existing.authProvider;
            throw new AppError(
                409,
                `This email is already linked to a ${existingLabel} account. Please sign in with ${existingLabel} instead.`,
            );
        }

        const { id, name, email, plan } = existing;
        return { id, name, email, plan };
    }

    // new user
    const user = await userRepo().save(
        userRepo().create({
            name: profile.name,
            email: profile.email,
            password: null,
            authProvider: profile.provider,
            providerId: profile.providerId,
            isEmailVerified: true,
        }),
    );

    const { id, name, email, plan } = user;
    return { id, name, email, plan };
};

export const refreshService = async (rawToken: string)
: Promise<{user: AuthUser, tokenPair: TokenPair }> => {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
        payload = verifyRefreshToken(rawToken);
    } catch {
        throw new AppError(
            401,
            "Invalid or expired refresh token. Please log in again.",
        );
    }

    const record = await tokenRepo().findOne({
        where: {
            tokenHash: sha256(rawToken),
            userId: payload.sub,
            isRevoked: false,
        },
    });

    if (!record || record.expiresAt < new Date()) {
        throw new AppError(
            401,
            "Refresh token is invalid or has expired. Please log in again.",
        );
    }

    await tokenRepo().update(record.id, { isRevoked: true });

    const u = await userRepo().findOne({ where: { id: payload.sub } });
    if (!u) {
        throw new AppError(401, "Account not found. Please log in again.");
    }

    const user = sanitize(u);
    const tokenPair = await issueTokenPair(user.id, user.name, user.email, user.plan);

    return { user, tokenPair };
};

export const logoutService = async (rawToken: string) => {
    // silenty succeed even if token is already gone
    await tokenRepo()
        .createQueryBuilder()
        .update()
        .set({ isRevoked: true })
        .where("tokenHash = :hash AND isRevoked = false", {
            hash: sha256(rawToken),
        })
        .execute();
};

// deletes revoked and expired tokens. node cron calls this
export const cleanupExpiredTokens = async () => {
    const result = await tokenRepo()
        .createQueryBuilder()
        .delete()
        .where("isRevoked = true OR expiresAt < :now", { now: new Date() })
        .execute();
    return result.affected ?? 0;
};
