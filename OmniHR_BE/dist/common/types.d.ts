export type AuthUser = {
    id: number;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
    employeeId?: number | null;
    mustChangePassword: boolean;
};
export type RequestContext = {
    ip?: string;
    userAgent?: string;
};
