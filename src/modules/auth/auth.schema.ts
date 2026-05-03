import { z } from "zod";

export const signupSchema = z.object({
    body: z.object({
        name: z
            .string({ required_error: "Name is required." })
            .trim()
            .min(2, "Name must be at least 2 characters.")
            .max(50, "Name must not exceed 50 characters."),

        email: z
            .string({ required_error: "Email is required." })
            .trim()
            .toLowerCase()
            .email("Please provide a valid email address."),

        password: z
            .string({ required_error: "Password is required." })
            .min(8, "Password must be at least 8 characters.")
            .max(72, "Password must not exceed 72 characters.")
            .regex(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
            ),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z
            .string({ required_error: "Email is required." })
            .trim()
            .toLowerCase()
            .email("Please provide a valid email address."),

        password: z
            .string({ required_error: "Password is required." })
            .min(1, "Password is required."),
    }),
});

export const verifyEmailSchema = z.object({
    body: z.object({
        email: z
            .string({ required_error: "Email is required." })
            .trim()
            .toLowerCase()
            .email("Please provide a valid email address."),
        code: z
            .string({ required_error: "Verification code is required." })
            .regex(/^\d{6}$/, "Verification code must be exactly 6 digits."),
    }),
});

export const resendVerificationSchema = z.object({
    body: z.object({
        email: z
            .string({ required_error: "Email is required." })
            .trim()
            .toLowerCase()
            .email("Please provide a valid email address."),
    }),
});

export type SignupDto = z.infer<typeof signupSchema>["body"];
export type LoginDto = z.infer<typeof loginSchema>["body"];
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>["body"];
export type ResendVerificationDto = z.infer<
    typeof resendVerificationSchema
>["body"];
