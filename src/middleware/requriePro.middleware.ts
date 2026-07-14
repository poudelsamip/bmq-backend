import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { Plans } from "../entities/User.entity";

export const requirePro = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user;

        if (!user) {
            throw new AppError(401, "authentication required")
        }

        if (user.plan !== Plans.PRO) {
            throw new AppError(403, "This action is only available for pro users")
        }

        next();
    } catch (error) {
        next(error)
    }
}