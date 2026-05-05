import { Plans } from "../entities/User.entity";

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    plan: Plans;
}
