import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.config";
import { randomUUID } from "crypto";
import { Plans } from "../entities/User.entity";

export interface AccessTokenPayload {
    sub: string;
    name: string;
    email: string;
    plan: Plans;
    type: "access";
}

export interface RefreshTokenPayload {
    sub: string;
    jti: string;
    type: "refresh";
}

export const parseDuration = (value: string): number => {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid duration format: "${value}"`);
    const n = parseInt(match[1], 10);
    const units: Record<string, number> = {
        s: 1_000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
    };
    return n * units[match[2]];
};

export const getRefreshTokenExpiry = (): Date =>
    new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN));

export const generateAccessToken = (
    userId: string,
    name: string,
    email: string,
    plan: Plans,
): string => {
    const payload: AccessTokenPayload = {
        sub: userId,
        email,
        name,
        plan,
        type: "access",
    };
    const options: SignOptions = {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    };
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

export const generateRefreshToken = (userId: string): string => {
    const payload: RefreshTokenPayload = {
        sub: userId,
        jti: randomUUID(),
        type: "refresh",
    };
    const options: SignOptions = {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    };
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
    const payload = jwt.verify(
        token,
        env.JWT_ACCESS_SECRET,
    ) as AccessTokenPayload;
    if (payload.type !== "access") {
        throw new Error("Invalid token type: expected access token.");
    }
    return payload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
    const payload = jwt.verify(
        token,
        env.JWT_REFRESH_SECRET,
    ) as RefreshTokenPayload;
    if (payload.type !== "refresh") {
        throw new Error("Invalid token type: expected refresh token.");
    }
    return payload;
};
