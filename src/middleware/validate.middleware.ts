import { Request, Response, NextFunction } from "express";
import { AnyZodObject } from "zod";

export const validate = (schema: AnyZodObject) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if (!result.success) {
            return next(result.error);
        }

        req.body = result.data.body;
        req.query = result.data.query;
        req.params = result.data.params;

        next();
    };
};
