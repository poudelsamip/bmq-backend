import { AuthUser } from "../interfaces/auth.interface";

declare global {
    namespace Express {
        interface User extends AuthUser {}
    }
}

export {};
