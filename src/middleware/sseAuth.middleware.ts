import { NextFunction, Request, Response } from "express";
import { verifyRefreshToken } from "../utils/jwt.utils";
import { AppDataSource } from "../config/db.config";
import { User } from "../entities/User.entity";
import { AppError } from "../utils/AppError";

export const authenticateAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        let { refreshToken } = req.cookies;

        const payload = verifyRefreshToken(refreshToken);

        const user = await AppDataSource.getRepository(User).findOne({
            where: { id: payload.sub },
        });

        if (!user) {
            throw new AppError(400, "User not found");
        }

        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            plan: user.plan,
        };

        next();
    } catch (error) {
        next(error);
    }
};
