import { createHash, randomInt } from "crypto";

export const OTP_EXPIRES_MS = 10 * 60 * 1_000;

export const RESEND_COOLDOWN_MS = 60 * 1_000;

export const generateOtp = (): string =>
    randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashOtp = (otp: string): string =>
    createHash("sha256").update(otp).digest("hex");
