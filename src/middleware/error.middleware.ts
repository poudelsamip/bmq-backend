import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { env } from "../config/env.config";
import { ZodError } from "zod";

// PostgreSQL error codes
const PG_UNIQUE_VIOLATION = "23505";

export const errorHandler = (
    err: Error & { code?: string; statusCode?: number },
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    console.error("[ERROR]\n");
    console.log(err);

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            data: null,
            // ...(env.NODE_ENV === "development" && { stack: err.stack }),
        });
        return;
    }

    if (err instanceof ZodError) {
        res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: err.flatten().fieldErrors,
        });
        return;
    }

    if (err.code === PG_UNIQUE_VIOLATION) {
        res.status(409).json({
            success: false,
            message: "A record with this information already exists.",
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

    res.status(500).json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
        data: null,
        // ...(env.NODE_ENV === "development" && { stack: err.stack }),
    });
};
