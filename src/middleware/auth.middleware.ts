import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt.utils";

export const authenticate = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const authHeader = req.headers.authorization;

        let token: string | null = null;
        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token) {
            throw new AppError(401, "Access token required");
        }

        const payload = verifyAccessToken(token);

        req.user = {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            plan: payload.plan,
        };

        next();
    } catch (error) {
        next(error);
    }
};
