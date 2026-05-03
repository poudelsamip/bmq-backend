export interface AuthUser {
    id: string;
    email: string;
}

declare global {
    namespace Express {
        interface User extends AuthUser {}
    }
}
