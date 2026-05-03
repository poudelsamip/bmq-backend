import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    PORT: z.coerce.number().default(3000),

    // db
    DB_HOST: z.string().min(1, "DB_HOST is required"),
    DB_PORT: z.coerce.number().default(5432),
    DB_USERNAME: z.string().min(1, "DB_USERNAME is required"),
    DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
    DB_NAME: z.string().min(1, "DB_NAME is required"),

    // jwt
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    // google oauth
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CALLBACK_URL: z
        .string()
        .default("http://localhost:3000/api/auth/google/callback"),

    // github oauth
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_CALLBACK_URL: z
        .string()
        .default("http://localhost:3000/api/auth/github/callback"),

    // frontend
    FRONTEND_URL: z.string().url().default("http://localhost:5173"),

    // email (resend provider)
    RESEND_API_KEY: z.string(),
    EMAIL_FROM: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error(
        "Invalid environment variables. Server cannot start. Please make sure all required environment variables are set properly:\n",
    );
    parsed.error.errors.forEach((e) => {
        console.error(`${e.path.join(".")}: ${e.message}`);
    });
    process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
