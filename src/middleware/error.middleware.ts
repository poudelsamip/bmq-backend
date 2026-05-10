import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { env } from "../config/env.config";
import { ZodError } from "zod";

const PG_NOT_NULL_VIOLATION = "23502";

// Redis connection error names (ioredis)
const REDIS_CONNECTION_ERRORS = new Set([
    "SocketClosedUnexpectedlyError",
    "ConnectionRefusedError",
    "ReconnectFailedError",
    "MaxRetriesPerRequestError",
    "ConnectionTimeoutError",
    "FailedToRefreshSlotsError",
]);

const isDev = env.NODE_ENV === "development";
const devMeta = (err: Error) => (isDev ? { stack: err.stack } : {});

export const errorHandler = (
    err: Error & { code?: string; statusCode?: number },
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    console.error("[ERROR]", err);

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            data: null,
            ...devMeta(err),
        });
        return;
    }

    if (err instanceof ZodError) {
        res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: err.flatten().fieldErrors,
            data: null,
            ...devMeta(err),
        });
        return;
    }

    if (err.code === PG_NOT_NULL_VIOLATION) {
        res.status(400).json({
            success: false,
            message: "A required field is missing.",
            data: null,
        });
        return;
    }

    if (err.name === "JsonWebTokenError") {
        res.status(401).json({
            success: false,
            message: "Invalid token. Please log in again.",
            data: null,
        });
        return;
    }

    if (err.name === "TokenExpiredError") {
        res.status(401).json({
            success: false,
            message: "Token has expired. Please log in again.",
            data: null,
        });
        return;
    }

    // redis errors

    const isClosed = err.message.toLowerCase().includes("connection is closed");

    if (
        REDIS_CONNECTION_ERRORS.has(err.name) ||
        isClosed ||
        err.code === "ECONNREFUSED"
    ) {
        res.status(503).json({
            success: false,
            message: isClosed
                ? "Your redis connection is closed. Please make sure your redis connection is open."
                : "Redis connection is unavailable.",

            data: null,
            // ...devMeta(err),
        });
        return;
    }

    res.status(500).json({
        success: false,
        message: isDev
            ? err.message
            : "An unexpected error occurred. Please try again later.",
        data: null,
        ...devMeta(err),
    });
};
