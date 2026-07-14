import { Plans } from "../entities/User.entity";

export const PLAN_PROJECT_LIMITS: Record<Plans, number> = {
    [Plans.FREE]: 1,
    [Plans.PRO]: 25,
};
